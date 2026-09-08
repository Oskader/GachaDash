import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { EventRow } from '@/components/event-row'
import { PageHeader } from '@/components/page-header'
import { countdownAt, phaseAt, requestNow } from '@/lib/urgency'
import { getI18n, type Dictionary, type Locale } from '@/lib/i18n'
import { PAUSED_GAMES, isPausedGame } from '@/lib/game-status'
import type { Database } from '@/lib/supabase/types'

export const metadata: Metadata = { title: 'Hoy' }

type GameRow = Database['public']['Tables']['games']['Row']

/** Fila de `events` con el juego embebido por el join. */
type EventWithGame = Database['public']['Tables']['events']['Row'] & {
  games: Pick<GameRow, 'slug' | 'name' | 'color_accent'> | null
}

export default async function HoyPage() {
  const { locale, t } = await getI18n()
  const supabase = await createClient()
  const now = requestNow()

  // Los juegos pausados (game-status.ts) siguen teniendo filas activas en la
  // BD a propósito — la pausa no toca datos — así que se excluyen en la propia
  // consulta, para que no consuman el limit(). El filtro posterior en memoria
  // es cinturón y tirantes: si el filtro de PostgREST fallara en silencio,
  // aquí no se cuela ninguno.
  const base = supabase
    .from('events')
    .select('*, games!inner(slug, name, color_accent)')
    .eq('is_active', true)
    .gte('end_date', new Date(now).toISOString())
    .order('end_date', { ascending: true })
    .limit(40)

  // Los slugs son del enum game_slug: sin comillas ni comas, el `in` de
  // PostgREST es seguro (el caso peligroso documentado eran títulos con
  // comillas dobles, no slugs).
  const query = PAUSED_GAMES.length
    ? base.not('games.slug', 'in', `(${PAUSED_GAMES.join(',')})`)
    : base

  const { data } = await query.returns<EventWithGame[]>()

  // Los semanales (Cyclical Extrapolation y compañía) viven en /ciclicos, no
  // aquí: su fecha de fin es ruido en una pantalla de "¿qué se me escapa?".
  // En memoria, no con .neq('kind', 'weekly'): las filas con kind NULL se
  // caerían del resultado de PostgREST y desaparecerían sin error.
  const rows = (data ?? []).filter(
    (e) => !isPausedGame(e.games?.slug ?? '') && e.kind !== 'weekly'
  )

  // Primer corte: lo que ya está en marcha contra lo que solo está anunciado.
  // Las wikis listan las dos cosas y mezclarlas confunde de dos maneras — un
  // evento futuro se colaba entre los urgentes, y su cuenta atrás era la de su
  // final, así que uno de 14 días marcaba 27.
  const live = rows.filter((e) => phaseAt(e.start_date, e.end_date, now) === 'live')
  const upcoming = rows
    .filter((e) => phaseAt(e.start_date, e.end_date, now) === 'upcoming')
    // Aquí ordena la llegada, no el cierre: es la pregunta de esta sección.
    .sort((a, b) => a.start_date.localeCompare(b.start_date))

  // Segundo corte por urgencia, no por juego: la pregunta de esta pantalla es
  // "¿qué se me escapa?", y eso no entiende de franquicias.
  const byLevel = (levels: string[]) =>
    live.filter((e) => levels.includes(countdownAt(e.end_date, now).level))

  return (
    <main className="mx-auto max-w-lg px-4 pb-10">
      <PageHeader
        title={t.hoy.title}
        meta={`${live.length} ${live.length === 1 ? t.hoy.activeEvent : t.hoy.activeEvents}`}
      />

      {rows.length === 0 ? (
        <EmptyState t={t} />
      ) : (
        <div className="space-y-9">
          <Group
            label={t.hoy.endsToday}
            events={byLevel(['high'])}
            emptyNote={t.hoy.nothingSoon}
            locale={locale}
            words={t.urgency}
            andMore={t.event.andMore}
          />
          <Group
            label={t.hoy.thisWeek}
            events={byLevel(['mid', 'low'])}
            locale={locale}
            words={t.urgency}
            andMore={t.event.andMore}
          />
          <Group
            label={t.hoy.later}
            events={byLevel(['none'])}
            locale={locale}
            words={t.urgency}
            andMore={t.event.andMore}
          />
          <Group
            label={t.hoy.upcoming}
            note={t.hoy.upcomingNote}
            events={upcoming}
            upcoming
            locale={locale}
            words={t.urgency}
            andMore={t.event.andMore}
          />
        </div>
      )}
    </main>
  )
}

function Group({
  label,
  note,
  events,
  emptyNote,
  upcoming = false,
  locale,
  words,
  andMore,
}: {
  label: string
  /** Aclaración bajo el título, cuando la sección la necesita. */
  note?: string
  events: EventWithGame[]
  emptyNote?: string
  upcoming?: boolean
  locale: Locale
  words: Dictionary['urgency']
  andMore: string
}) {
  if (events.length === 0 && !emptyNote) return null

  return (
    <section>
      <h2 className="eyebrow mb-3">{label}</h2>
      {note && events.length > 0 && (
        <p className="-mt-1 mb-3 text-xs text-[var(--text-faint)]">{note}</p>
      )}
      {events.length === 0 ? (
        <p className="text-sm text-dim">{emptyNote}</p>
      ) : (
        <div>
          {events.map((event) => (
            <EventRow
              key={event.id}
              event={event}
              accentColor={event.games?.color_accent ?? 'var(--urgency-none)'}
              gameName={event.games?.name}
              upcoming={upcoming}
              locale={locale}
              words={words}
              andMore={andMore}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function EmptyState({ t }: { t: Dictionary }) {
  return (
    <div className="border border-line bg-panel px-5 py-8 text-center">
      <p className="mb-1 text-sm font-medium text-foreground">
        {t.hoy.emptyTitle}
      </p>
      <p className="mb-5 text-sm text-dim">{t.hoy.emptyBody}</p>
      <Link
        href="/juegos"
        className="tabular text-xs uppercase tracking-[0.14em] text-foreground underline underline-offset-4 hover:text-[var(--urgency-low)]"
      >
        {t.hoy.seeGames}
      </Link>
    </div>
  )
}
