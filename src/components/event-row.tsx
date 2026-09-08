import Image from 'next/image'
import { CountdownLabel, Fuse } from '@/components/ui/countdown'
import { pickDescription, type Locale } from '@/lib/i18n/shared'
import type { UrgencyWords } from '@/lib/urgency'
import type { Database } from '@/lib/supabase/types'

type EventRow = Database['public']['Tables']['events']['Row']

interface Props {
  event: EventRow
  accentColor: string
  /** En la vista agregada hace falta saber de qué juego es cada fila. */
  gameName?: string
  locale: Locale
  /** Palabras del lector de pantalla, para la cuenta atrás. */
  words: UrgencyWords
  /** Plantilla "y {n} más" del corte de recompensas. */
  andMore: string
  /**
   * La fila va en la sección de futuro: la cuenta atrás mira al arranque y
   * no al final. Lo decide la página, que es quien tiene el `now` de la
   * petición; aquí no se lee el reloj.
   */
  upcoming?: boolean
}

/**
 * Fuentes cuyo banner es mucho más apaisado que la miniatura.
 *
 * Importa por dos cosas a la vez, y las dos se ven:
 *
 * - `sizes`. Declara cuántos píxeles hace falta y el navegador elige candidato
 *   POR ANCHURA. Pero con `object-cover` y un origen más apaisado que la caja,
 *   quien manda es el ALTO: Endfield sirve 5.5:1, así que cubrir 117 px de alto
 *   exige ~645 px de origen, no los 208 que mide la caja. Declarar la caja hacía
 *   que el navegador se trajera un fichero de 70 px de alto y lo ampliara 2x —
 *   borroso, y sin ningún error por ningún lado.
 * - `object-position`. El recorte centrado de un banner 5.5:1 cae justo en
 *   mitad del rótulo y parte las palabras ("Echo", "THE REA"). Desde la
 *   izquierda entra el arte y el título empieza donde debe.
 *
 * Ninguna de las dos se puede poner para todas: un `sizes` generoso global
 * hace que las 16:9 bajen 73 KB donde les bastan 20, y `object-position` en una
 * 16:9 dentro de una caja 16:9 no recorta nada, así que no haría nada.
 *
 * El host es el único dato disponible —no guardamos las dimensiones— y es
 * exacto: comprobado el 2026-08-26, de las cuatro wikis solo endfield.wiki.gg
 * entrega sub-banners apaisados. Las demás son 16:9 o cuadradas.
 */
const WIDE_BANNER_HOST = 'endfield.wiki.gg'

/**
 * Una fila de evento.
 *
 * Jerarquía deliberada: la cuenta atrás pesa lo mismo que el título,
 * porque en un gacha la pregunta no es "qué evento es" sino "cuánto me
 * queda". La mecha de abajo cierra la fila y da la lectura de un vistazo.
 */
export function EventRow({
  event,
  accentColor,
  gameName,
  locale,
  words,
  andMore,
  upcoming = false,
}: Props) {
  const rewards = event.rewards as { items?: string[] } | null
  const items = rewards?.items ?? []
  const wideBanner = event.image_url?.includes(WIDE_BANNER_HOST) ?? false

  // Cae al otro idioma si falta la traducción: mejor inglés que una tarjeta
  // muda mientras la cola de traducción se vacía.
  const description = pickDescription(event, locale)

  return (
    <article className="group relative border-b border-line py-4 last:border-b-0">
      {gameName && (
        <div className="mb-1.5 flex items-center gap-2">
          <span
            className="h-2.5 w-[3px] shrink-0"
            style={{ backgroundColor: accentColor }}
            aria-hidden="true"
          />
          <span className="tabular text-[10px] uppercase tracking-[0.14em] text-dim">
            {gameName}
          </span>
        </div>
      )}

      <div className="flex gap-3">
        {event.image_url && (
          // 16:9, la proporción nativa de tres de las cuatro fuentes. La
          // cuarta (Endfield, 5.5:1) se recorta por los lados; de dónde y con
          // cuántos píxeles, en WIDE_BANNER_HOST.
          <div className="relative h-[86px] w-[152px] shrink-0 overflow-hidden rounded-sm border border-line sm:h-[117px] sm:w-[208px]">
            <Image
              src={event.image_url}
              // Decorativa: el título va justo al lado y repetirlo solo
              // ensucia el lector de pantalla.
              alt=""
              fill
              // q=90 (whitelist en next.config.ts). El default de Next 16 es 75
              // y se nota en los rotulos de texto del banner; subir a 90 reduce
              // la cuantizacion del croma 4:2:0 sin disparar el tamano mucho.
              quality={90}
              // Ver WIDE_BANNER_HOST: para el banner apaisado esto NO es el
              // ancho de la caja sino alto × 5.5, que es lo que de verdad
              // hace falta para cubrirla.
              sizes={
                wideBanner
                  ? '(min-width: 640px) 650px, 480px'
                  : '(min-width: 640px) 208px, 152px'
              }
              className={`object-cover ${wideBanner ? 'object-left' : ''}`}
            />
            {/* Identidad del juego: stripe en el borde izquierdo de la
                miniatura, presente también en la página del propio juego. */}
            <span
              className="absolute inset-y-0 left-0 z-10 w-[3px]"
              style={{ backgroundColor: accentColor }}
              aria-hidden="true"
            />
          </div>
        )}

        {/* min-w-0 para que el line-clamp-2 del título pueda encoger. */}
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-start justify-between gap-4">
            <h3 className="line-clamp-2 flex-1 text-base font-semibold leading-snug text-foreground">
              {event.title}
            </h3>
            <CountdownLabel
              startDate={upcoming ? event.start_date : undefined}
              endDate={event.end_date}
              className="shrink-0"
              words={words}
            />
          </div>

          {items.length > 0 && (
            <ul className="mb-3 flex flex-wrap gap-x-3 gap-y-1">
              {items.slice(0, 4).map((reward, i) => (
                <li
                  key={`${reward}-${i}`}
                  className="tabular text-[11px] text-dim before:mr-1.5 before:text-[var(--text-faint)] before:content-['+']"
                >
                  {reward}
                </li>
              ))}
              {items.length > 4 && (
                <li className="tabular text-[11px] text-[var(--text-faint)]">
                  {andMore.replace('{n}', String(items.length - 4))}
                </li>
              )}
            </ul>
          )}
        </div>
      </div>

      {/* La descripción cruza la fila entera, debajo: la columna del título es
          demasiado estrecha para ella y el line-clamp se comía el final ("…")
          sin que sobrara espacio debajo. Sin clamp, completa. */}
      {description && (
        <p className="mb-3 mt-3 text-xs leading-relaxed text-dim">{description}</p>
      )}

      <Fuse startDate={event.start_date} endDate={event.end_date} />
    </article>
  )
}
