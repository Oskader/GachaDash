import * as cheerio from 'cheerio'
import { parseDuration } from './dates'
import { cleanTitle } from './normalize'

/**
 * Parseo determinista de las listas de eventos.
 *
 * La versión anterior hacía `$('body').text()` y le pedía a un LLM que
 * reconstruyera la tabla a partir del texto plano. Eso destruía la estructura
 * que la fuente ya traía hecha, y el modelo devolvía nombres mutilados,
 * duplicados y fechas inventadas.
 *
 * Aquí no hay modelo: se lee la tabla. Si la wiki cambia de formato, el
 * parser devuelve 0 filas y el runner lo reporta como fallo, que es mucho
 * mejor que guardar datos plausibles pero falsos.
 */

export interface ParsedEvent {
  title: string
  start_date: string
  end_date: string
  /** "Current" | "Upcoming" — de qué sección de la página salió. */
  section: string
  /**
   * Nombre de la página del evento en la wiki, tal cual lo enlaza la tabla.
   * No coincide siempre con `title`, porque este último se limpia para
   * mostrarlo y la wiki usa subpáginas ("Divergent Universe/...").
   * Es lo que permite ir a buscar la descripción a su propia página.
   */
  pageTitle?: string
  /**
   * Banner del evento, tal cual lo trae la propia lista.
   *
   * Sale del mismo HTML que el título y las fechas: no cuesta ninguna
   * petición. `undefined` cuando la wiki no tiene la imagen subida — pasa de
   * verdad, y `mw-broken-media` no emite `<img>`, así que cae solo.
   */
  image_url?: string
}

/** El enlace de la celda apunta a la página del evento; File: y rojos no valen. */
function pageTitleFromCell($: cheerio.CheerioAPI, td: unknown): string | undefined {
  const link = $(td as never)
    .find('a')
    .filter((_i, a) => {
      const href = $(a).attr('href') ?? ''
      const t = $(a).attr('title') ?? ''
      if (/\/wiki\/File:/i.test(href) || /^File:/i.test(t)) return false
      // Los enlaces rojos apuntan a páginas que no existen.
      return !/redlink=1/.test(href) && !/\(page does not exist\)/i.test(t)
    })
    .first()

  const title = (link.attr('title') ?? '').trim()
  return title || undefined
}

/**
 * Techo de resolución que se le pide a la wiki.
 *
 * No es lo que descarga nadie: `next/image` busca este original en el servidor
 * y sirve al ancho que pida el navegador. Así que esto solo fija cuántos
 * píxeles hay DISPONIBLES, y quedarse corto no se puede compensar después.
 *
 * 960 y no 480 por Endfield. Sus banners son 5.5:1 y la miniatura los recorta
 * a 16:9, así que quien manda es el alto: a 480 de ancho el fichero tiene 87 px
 * de alto, y una caja de 90 px a doble densidad pide 180. Ampliaba 2x y se veía
 * borroso. A 960 el original trae 175 y llega justo. Las dos wikis lo sirven.
 */
const THUMB_WIDTH = 960

/** El ancho pedido, en las dos sintaxis de miniatura que hay entre las cuatro wikis. */
function widenThumb(url: string): string {
  return url
    .replace(/\/scale-to-width-down\/\d+/, `/scale-to-width-down/${THUMB_WIDTH}`)
    .replace(/\/\d+px-/, `/${THUMB_WIDTH}px-`)
}

/**
 * URL absoluta y a resolución utilizable.
 *
 * Fandom sirve por `scale-to-width-down/<n>`; Endfield por
 * `/images/thumb/<f>/<n>px-<f>`, y además la devuelve relativa, así que
 * necesita el host delante o la URL guardada es inservible.
 *
 * El reescalado va DESPUÉS de absolutizar y en las tres ramas a propósito: la
 * de `//` se lo saltaba, y aunque hoy no la use ninguna wiki, era una fuente
 * silenciosa de miniaturas al ancho de origen.
 */
function absoluteImageUrl(src: string, host?: string): string | undefined {
  if (src.startsWith('//')) return widenThumb(`https:${src}`)
  if (src.startsWith('/')) return host ? widenThumb(`https://${host}${src}`) : undefined
  return widenThumb(src)
}

/**
 * Primera imagen real de un contenedor.
 *
 * Comprobado el 2026-08-25 contra las cuatro wikis: `action=parse` SÍ trae
 * `data-src` en la mayoría de filas — solo las primeras de cada tabla llegan
 * sin la clase `lazyload`. Fandom marca esas filas con
 * `class="mw-file-element lazyload"` y deja en `src` un GIF de 1×1 en
 * `data:` puro; la URL real vive en `data-src`. Por eso NO basta con
 * `src ?? data-src`: `??` solo cae al segundo operando cuando el primero es
 * `null`/`undefined`, y aquí `src` está presente (es el placeholder), así que
 * la URL de verdad nunca se leía. Un enlace rojo (`mw-broken-media`) no
 * imprime ningún `<img>`, así que ese caso sigue cayendo solo.
 */
function imageFrom(
  $: cheerio.CheerioAPI,
  scope: unknown,
  host?: string
): string | undefined {
  const img = $(scope as never).find('img').first()
  const src = img.attr('src')
  const real = src && !src.startsWith('data:') ? src : img.attr('data-src')
  if (!real || real.startsWith('data:')) return undefined
  return absoluteImageUrl(real, host)
}

/** Solo estas secciones. "Permanent" y los archivos por año no interesan. */
const WANTED_SECTIONS = /^(current|ongoing|upcoming)$/i

/**
 * Encabezado <h2..h4> que precede a un elemento en el árbol.
 *
 * Cheerio 1.x no reexporta los tipos de nodo de domhandler, así que se navega
 * con una forma estructural mínima en vez de con sus tipos.
 */
interface DomNodeish {
  tagName?: string
  prev: DomNodeish | null
  parent: DomNodeish | null
}

function precedingHeading(
  $: cheerio.CheerioAPI,
  el: DomNodeish
): string | null {
  let node: DomNodeish | null = el
  while (node) {
    let sibling: DomNodeish | null = node.prev
    while (sibling) {
      if (sibling.tagName && /^h[2-4]$/i.test(sibling.tagName)) {
        return $(sibling as never).text().replace(/\[edit\]/gi, '').trim()
      }
      sibling = sibling.prev
    }
    node = node.parent
  }
  return null
}

/**
 * Wikis de Fandom (HSR, ZZZ, Wuthering Waves).
 * Las páginas de eventos traen tablas con columnas Event | Duration | ...
 * agrupadas bajo encabezados Current / Upcoming / Permanent.
 */
export function parseFandomTables(html: string): ParsedEvent[] {
  const $ = cheerio.load(html)
  const out: ParsedEvent[] = []

  $('table').each((_, table) => {
    const $table = $(table)
    const headers = $table
      .find('tr')
      .first()
      .find('th,td')
      .map((_i, cell) => $(cell).text().trim())
      .get()

    const eventCol = headers.findIndex((h) => /^event$/i.test(h))
    const durationCol = headers.findIndex((h) => /^duration$/i.test(h))
    if (eventCol < 0 || durationCol < 0) return

    const section = (precedingHeading($, table as unknown as DomNodeish) ?? '').replace(/\[\]/g, '').trim()
    if (!WANTED_SECTIONS.test(section)) return

    $table.find('tr').slice(1).each((_i, row) => {
      const cells = $(row).find('td,th')
      if (cells.length < 2) return

      const dates = parseDuration($(cells.get(durationCol)).text())
      if (!dates) return

      // El texto visible de la celda, no el atributo `title` del enlace:
      // ese trae la ruta con subpáginas de la wiki
      // ("Threshold Simulation/Hard Mode/Myriad Endgame").
      const title = cleanTitle($(cells.get(eventCol)).text())
      if (!title) return

      out.push({
        title,
        ...dates,
        section,
        pageTitle: pageTitleFromCell($, cells.get(eventCol)),
        image_url: imageFrom($, cells.get(eventCol)),
      })
    })
  })

  return out
}

/**
 * endfield.wiki.gg no usa tabla: renderiza tarjetas `.mp-event` con el nombre
 * entre corchetes y una línea de horario por región.
 */
/**
 * Warp/List de HSR (Fandom): banners de gacha con rates-up.
 *
 * Estructura (sección "Event Warps" con sub-secciones Current/Upcoming):
 *
 *   <h4>Current</h4>
 *   <table>
 *     <tr><th>Type</th><th>Warps</th></tr>
 *     <tr><th colspan="2">Version 4.5: August 26, 2026 — September 12, 2026</th></tr>
 *     <tr>
 *       <td>Character Event</td>
 *       <td>
 *         <div class="warp-banners">
 *           <div>
 *             <span typeof="mw:File"><a href="..."><img .../></a></span>
 *             <a href="...">Summer Chorus</a>
 *           </div>
 *         </div>
 *       </td>
 *     </tr>
 *   </table>
 *
 * Los banners de Light Cone comparten ventana con los de personaje, así
 * que solo lee los "Character Event" y "Light Cone Event" de Current/Upcoming.
 * La fecha es la del header de versión (compartida por todos los banners
 * de esa fila).
 */
export function parseHsrWarps(html: string, section: string, host: string): ParsedEvent[] {
  const $ = cheerio.load(html)
  const out: ParsedEvent[] = []

  // Solo las secciones Current y Upcoming interesan.
  if (!/^(current|upcoming)$/i.test(section)) return out

  // Buscar el heading de la sección y la tabla que le sigue.
  const heading = $(`h3, h4, h5`).filter((_i, el) => {
    return /^(current|upcoming)$/i.test($(el).text().trim())
  }).first()

  if (!heading.length) return out

  // La primera tabla tras el heading contiene los banners.
  const table = heading.nextAll('table').first()
  if (!table.length) return out

  let currentDates: { start_date: string; end_date: string } | null = null

  table.find('tr').each((_i, row) => {
    const cells = $(row).find('th, td')
    if (cells.length === 0) return

    // Header de versión con fechas: <th>Version X.Y: fecha — fecha</th>
    if (cells.length === 1) {
      const headerText = $(cells[0]).text()
      const dateMatch = headerText.match(/(\w+ \d{1,2}, \d{4})\s*[—–-]\s*(\w+ \d{1,2}, \d{4})/)
      if (dateMatch) {
        const start = new Date(dateMatch[1] + ' UTC')
        const end = new Date(dateMatch[2] + ' 23:59:59 UTC')
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          currentDates = {
            start_date: start.toISOString(),
            end_date: end.toISOString(),
          }
        }
      }
      return
    }

    // Fila con tipo + banners
    if (cells.length < 2 || !currentDates) return

    const type = $(cells[0]).text().toLowerCase()
    // Solo Character Event y Light Cone Event.
    if (!/character|light cone/.test(type)) return

    const bannersCell = $(cells[1])
    bannersCell.find('.warp-banners div').each((_j, bannerDiv) => {
      // El link con el texto es el segundo <a> (el primero es el de la imagen).
      const links = $(bannerDiv).find('a')
      const link = links.filter((_i, a) => {
        const href = $(a).attr('href') ?? ''
        return href.startsWith('/wiki/') && !href.includes(':') && $(a).text().trim()
      }).first()

      const title = cleanTitle(link.text())
      if (!title) return

      const img = $(bannerDiv).find('img').first()
      const src = img.attr('data-src') ?? img.attr('src')
      if (!src || src.startsWith('data:')) return

      // Saltar Light Cone banners (no interesan para /banners).
      if (/light cone/i.test(type)) return

      // Saltar banners de colaboración Fate (permanentes/semi-permanentes).
      // Estos no son banners de gacha rotativos: Saber, Archer, Rin, Gilgamesh,
      // Excalibur, Enuma Elish... son una colaboración indefinida.
      if (/fate|saber|archer|rin|gilgamesh|excalibur|enuma elish|gem coursing|bone of my sword/i.test(title)) return

      out.push({
        title,
        ...currentDates,
        section,
        pageTitle: link.attr('title') || undefined,
        image_url: absoluteImageUrl(src, host),
      })
    })
  })

  return out
}

/**
 * endfield.wiki.gg no usa tabla: renderiza tarjetas `.mp-event` con el nombre
 * entre corchetes y una línea de horario por región.
 */
export function parseEndfieldCards(
  html: string,
  section: string,
  host: string
): ParsedEvent[] {
  const $ = cheerio.load(html)
  const out: ParsedEvent[] = []

  $('.mp-event').each((_, card) => {
    const header = $(card).find('.mp-event-header').first().text()
    const title = cleanTitle(header)
    if (!title) return

    // Hay una línea por región. Se prefiere la occidental; si no está,
    // vale la primera, porque la diferencia entre husos es de horas y la
    // app razona en días.
    let line: string | null = null
    $(card).find('.mp-event-timer').each((_i, timer) => {
      const text = $(timer).text()
      if (/americas|europe/i.test(text)) line = text
      else if (!line) line = text
    })
    if (!line) return

    const dates = parseDuration(String(line).replace(/^[^:]*:\s*/, ''))
    if (!dates) return

    // El enlace a la página del evento cuelga de la tarjeta (de la imagen),
    // no de la cabecera.
    const link = $(card).find('a[title]').first()
    const pageTitle = (link.attr('title') ?? '').trim() || undefined

    out.push({
      title,
      ...dates,
      section,
      pageTitle,
      // La wiki devuelve ruta relativa; sin el host la URL no vale para nada.
      image_url: imageFrom($, card, host),
    })
  })

  return out
}
