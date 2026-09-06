import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { fetchMediaWiki, fetchSectionIndex } from './browser'
import { parseEndfieldCards, parseFandomTables, type ParsedEvent } from './parsers'
import { dedupeByTitle, dedupKey } from './normalize'
import { fetchHoyoEnrichment } from './hoyo-announcements'
import { fetchDescriptions } from './descriptions'
import { translateToSpanish } from './translate'
import { SOURCES } from './sources'
import { isPausedGame } from '@/lib/game-status'
import { classifyEvent } from './classify'

export interface ScrapeResult {
  success: boolean
  eventsUpserted: number
  eventsParsed?: number
  eventsEnriched?: number
  duplicatesCollapsed?: number
  eventsDeactivated?: number
  eventsExpired?: number
  eventsTranslated?: number
  /** Solo en seco: lo que se habria escrito, para poder revisarlo. */
  rows?: unknown[]
  eventsWithoutDescription?: number
  eventsWithoutImage?: number
  error?: string
  /** El juego está en PAUSED_GAMES: la pasada no se ejecuta en absoluto. */
  paused?: boolean
}

function getServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient<Database>(url, key)
}

/** Descarga y parsea la lista de eventos según la fuente del juego. */
async function collectEvents(gameSlug: string): Promise<ParsedEvent[]> {
  const source = SOURCES[gameSlug]
  if (!source) throw new Error(`No source configured for ${gameSlug}`)

  if (source.parser === 'endfield-cards') {
    const available = await fetchSectionIndex(source.sourceUrl)
    const collected: ParsedEvent[] = []

    for (const label of source.sections ?? []) {
      const index = available.get(label.toLowerCase())
      // Que falte una sección declarada es un cambio de maquetación, no un
      // "hoy no hay nada": hay que verlo, igual que el parseo de 0 filas.
      if (!index) {
        throw new Error(
          `La sección "${label}" ya no existe en ${source.humanUrl} ` +
            `(hay: ${[...available.keys()].join(', ')})`
        )
      }
      const { html } = await fetchMediaWiki(`${source.sourceUrl}&section=${index}`)
      collected.push(...parseEndfieldCards(html, label, source.wikiHost))
    }
    return collected
  }

  const { html } = await fetchMediaWiki(source.sourceUrl)
  return parseFandomTables(html)
}

export async function runScraperForGame(
  gameSlug: string,
  options: { dryRun?: boolean } = {}
): Promise<ScrapeResult> {
  // Pausa global (game-status.ts): ni fetch ni escritura, tampoco en seco.
  // Pausa es pausa — no hay override para forzar un scrape manual.
  if (isPausedGame(gameSlug)) {
    return { success: true, paused: true, eventsUpserted: 0 }
  }

  const source = SOURCES[gameSlug]
  if (!source) {
    return { success: false, eventsUpserted: 0, error: `Unknown game: ${gameSlug}` }
  }

  // Una sola lectura del reloj para toda la pasada: decide qué ocurrencia gana
  // el dedupe y qué filas siguen vigentes, y las dos respuestas tienen que ser
  // coherentes entre sí.
  const now = Date.now()

  let supabase: ReturnType<typeof getServiceRoleClient>
  try {
    supabase = getServiceRoleClient()
  } catch (err) {
    return { success: false, eventsUpserted: 0, error: String(err) }
  }

  const { data: game } = await supabase
    .from('games')
    .select('id')
    .eq('slug', gameSlug as Database['public']['Enums']['game_slug'])
    .single()

  if (!game) {
    return { success: false, eventsUpserted: 0, error: `Game not found: ${gameSlug}` }
  }

  // 1. Lista de eventos, parseada de la estructura que la fuente ya trae.
  let parsed: ParsedEvent[]
  try {
    parsed = await collectEvents(gameSlug)
  } catch (err) {
    return { success: false, eventsUpserted: 0, error: `Fetch/parse failed: ${err}` }
  }

  // Cero filas con la descarga correcta significa que la wiki cambió de
  // formato. Es un fallo que hay que ver, no un "hoy no hay eventos": si se
  // devolviera éxito, la app se quedaría con datos viejos sin avisar.
  if (parsed.length === 0) {
    return {
      success: false,
      eventsUpserted: 0,
      eventsParsed: 0,
      error: `Parsed 0 events from ${source.humanUrl} — el formato de la página pudo cambiar`,
    }
  }

  const deduped = dedupeByTitle(parsed, now)

  // 2. Descripciones, en dos capas.
  //
  //    El tablón oficial es la mejor fuente —lo redacta el estudio— pero solo
  //    cubre los anuncios vigentes de HSR y ZZZ: llegaba a 10 de 36 eventos.
  //    Para el resto se va a la página propia de cada evento en la wiki, que
  //    es donde está explicado qué hace.
  const [enrichment, wikiDescriptions] = await Promise.all([
    fetchHoyoEnrichment(gameSlug),
    fetchDescriptions(
      source.wikiHost,
      deduped.map((e) => ({
        key: e.title,
        // La página BASE primero. La subpágina con fecha describe esa
        // ocurrencia concreta y arranca con el reparto de personajes o el
        // horario; la base explica qué es el evento, que es lo que queremos.
        candidates: [
          e.pageTitle?.replace(/\/\d{4}-\d{2}-\d{2}$/, ''),
          e.title,
          e.pageTitle,
        ].filter((t): t is string => Boolean(t)),
      }))
    ),
  ])
  let enriched = 0

  // 3. Merge contra lo ya guardado, para que una pasada sin descripción no
  //    borre una buena de la pasada anterior.
  //    Se traen todas las filas del juego y se cruzan en memoria, por el mismo
  //    motivo que en el paso 4: un `in` sobre títulos con comillas no casa.
  const { data: existing } = await supabase
    .from('events')
    .select('title, description_en, description_es, rewards, image_url')
    .eq('game_id', game.id)

  const previous = new Map((existing ?? []).map((row) => [row.title, row]))

  /**
   * El pipeline anterior guardaba como descripción cosas que no lo eran:
   * "Collaboration", "Web", el contenido de la columna Type. Al arrastrarlas
   * hacia delante ensuciarían las tarjetas, así que solo se conserva lo que
   * parece una frase.
   */
  const usableDescription = (value: string | null | undefined) =>
    value && value.trim().length >= 30 ? value : null

  let missingDescription = 0
  let missingImage = 0
  let expired = 0

  // Primera vuelta: resolver el inglés y decidir quién necesita traducción.
  const resolved = deduped.map((event) => {
    const extra = enrichment.get(dedupKey(event.title))
    const prev = previous.get(event.title)

    // Orden de preferencia: tablón oficial (lo escribe el estudio) > página
    // del evento en la wiki > lo que ya hubiera guardado, si es una frase.
    const description_en =
      extra?.description ??
      wikiDescriptions.get(event.title) ??
      usableDescription(prev?.description_en)

    if (extra?.description) enriched++

    // El español oficial gana siempre: lo redacta el estudio.
    // Si no lo hay, se reaprovecha el guardado SOLO si el inglés no ha
    // cambiado; si cambió, la traducción vieja ya no describe lo mismo.
    const officialEs = usableDescription(extra?.description_es)
    const reusableEs =
      prev?.description_en === description_en
        ? usableDescription(prev?.description_es)
        : null

    return { event, extra, prev, description_en, description_es: officialEs ?? reusableEs }
  })

  // Traducir solo lo que no tiene español todavía. En régimen normal son
  // cero o tres llamadas, no una por evento.
  const translated = await translateToSpanish(
    resolved
      .filter((r) => !r.description_es && r.description_en)
      .map((r) => ({ key: r.event.title, textEn: r.description_en as string }))
  )

  const rows = resolved.map(({ event, extra, prev, ...resolvedRow }) => {
    const description_en = resolvedRow.description_en
    const description_es =
      resolvedRow.description_es ?? translated.get(event.title) ?? null

    if (!description_en) {
      missingDescription++
      console.warn(`[${gameSlug}] sin descripción: "${event.title}"`)
    }

    // Cadena de preferencia. El primer eslabón es el banner oficial, que hoy
    // vale siempre `undefined` — ver el comentario de `Enrichment.banner`.
    // El último es lo guardado: una pasada sin imagen NO puede borrar una
    // buena, igual que con las descripciones. Una wiki puede romper una
    // imagen un día y arreglarla al siguiente.
    const image_url = extra?.banner ?? event.image_url ?? prev?.image_url ?? null
    if (!image_url) missingImage++

    // El tablón oficial da la hora exacta; la wiki solo el día.
    const start_date = extra?.start_date ?? event.start_date
    const end_date = extra?.end_date ?? event.end_date

    // Clasificación del evento (banner / mission / login_event / other).
    // Se hace DESPUÉS del merge con HoYo porque la fecha definitiva se decide
    // en las dos líneas de arriba: clasificar con fechas de wiki que luego
    // cambian daría clasificaciones inconsistentes entre pasadas.
    const kind = classifyEvent({ title: event.title, start_date, end_date }, gameSlug)

    // `is_active` es "¿sigue vivo?", no "¿lo lista la fuente?". Marcarlo
    // siempre true dejaba activos en la base de datos eventos terminados hace
    // semanas, porque la reconciliación solo mira lo que la fuente deja de
    // listar y las tablas "Current" de las wikis se quedan desfasadas.
    const live = Date.parse(end_date) > now
    if (!live) expired++

    return {
      game_id: game.id,
      title: event.title,
      description_en,
      description_es,
      start_date,
      end_date,
      rewards: prev?.rewards ?? null,
      source_url: source.humanUrl,
      image_url,
      is_active: live,
      kind,
    }
  })

  // En seco se hace TODO el trabajo —descarga, parseo, descripciones,
  // traducción— y se devuelve lo que se habría escrito, sin escribirlo ni
  // reconciliar. Es la única forma de revisar una traducción antes de que
  // llegue a la base de datos.
  if (options.dryRun) {
    return {
      success: true,
      eventsUpserted: 0,
      eventsParsed: parsed.length,
      eventsEnriched: enriched,
      duplicatesCollapsed: parsed.length - deduped.length,
      eventsTranslated: translated.size,
      eventsExpired: expired,
      eventsWithoutDescription: missingDescription,
      eventsWithoutImage: missingImage,
      rows,
    }
  }

  const { error: upsertError } = await supabase
    .from('events')
    .upsert(rows, { onConflict: 'game_id,title', ignoreDuplicates: false })

  if (upsertError) {
    return { success: false, eventsUpserted: 0, error: upsertError.message }
  }

  // 4. Reconciliar: lo que la fuente ya no lista deja de estar activo.
  //
  //    Sin esto la tabla solo crece. Arrastraba 191 filas —duplicados de
  //    versiones anteriores del scraper y eventos terminados hace meses— que
  //    seguían saliendo en la app. Se desactiva en vez de borrar: es
  //    reversible y conserva el histórico.
  //    La comparación se hace en memoria, no con filtros `in`/`not.in` sobre
  //    títulos: hay eventos cuyo nombre lleva comillas dobles —por ejemplo
  //    Wuthering Waves Fan Creation Event "Blade of Past Resounds"— y PostgREST
  //    no los casa dentro de una lista, así que el scraper desactivaba una fila
  //    que acababa de escribir y la reactivaba en la pasada siguiente.
  const { data: activeRows } = await supabase
    .from('events')
    .select('id, title, end_date')
    .eq('game_id', game.id)
    .eq('is_active', true)

  // Vigente = lo lista la fuente Y no ha terminado. La segunda mitad recoge
  // además las filas heredadas que ninguna pasada anterior llegó a tocar.
  const wanted = new Set(rows.filter((r) => r.is_active).map((r) => r.title))
  const staleIds = (activeRows ?? [])
    .filter((r) => !wanted.has(r.title) || Date.parse(r.end_date) <= now)
    .map((r) => r.id)

  let deactivated = 0
  if (staleIds.length > 0) {
    const { count } = await supabase
      .from('events')
      .update({ is_active: false }, { count: 'exact' })
      .in('id', staleIds)
    deactivated = count ?? 0
  }

  return {
    success: true,
    eventsUpserted: rows.length,
    eventsParsed: parsed.length,
    eventsEnriched: enriched,
    duplicatesCollapsed: parsed.length - deduped.length,
    eventsDeactivated: deactivated,
    eventsExpired: expired,
    eventsTranslated: translated.size,
    eventsWithoutDescription: missingDescription,
    eventsWithoutImage: missingImage,
  }
}
