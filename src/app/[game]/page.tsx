import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/page-header'
import { EventRow } from '@/components/event-row'
import { ChecklistSection } from './components/ChecklistSection'
import { SubNav } from './components/SubNav'
import { getI18n } from '@/lib/i18n'
import { isPausedGame } from '@/lib/game-status'
import { phaseAt, requestNow } from '@/lib/urgency'
import type { Database } from '@/lib/supabase/types'

interface Props {
  params: Promise<{ game: string }>
}

type GameSlug = Database['public']['Enums']['game_slug']

async function getGame(slug: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('games')
    .select('*')
    .eq('slug', slug as GameSlug)
    .single()
  return data
}

// Sin esto las cuatro páginas de juego compartían título y descripción.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { game: slug } = await params
  const { t } = await getI18n()
  const game = await getGame(slug)

  if (!game) return { title: t.game.notFound }

  return {
    title: game.name,
    description: isPausedGame(game.slug)
      ? `${t.paused.comingSoon}. ${t.paused.note}`
      : t.game.metaDescription.replace('{game}', game.name),
  }
}

export default async function GamePage({ params }: Props) {
  const { game: gameSlug } = await params
  const { locale, t } = await getI18n()
  const supabase = await createClient()
  const now = requestNow()

  const game = await getGame(gameSlug)
  if (!game) notFound()

  // Pausado (game-status.ts): placeholder con la identidad del juego — nombre
  // y stripe de color — y nada más. Nunca notFound(): la ruta sigue válida.
  if (isPausedGame(game.slug)) {
    return (
      <main className="mx-auto max-w-lg px-4 pb-10">
        <PageHeader
          title={game.name}
          accentColor={game.color_accent}
          meta={t.paused.comingSoon}
        />

        <div className="border border-line bg-panel px-5 py-8 text-center">
          <p className="eyebrow mb-3">{t.paused.comingSoon}</p>
          <p className="text-sm text-dim">{t.paused.note}</p>
        </div>
      </main>
    )
  }

  const [{ data: events }, { data: checklistItems }] = await Promise.all([
    supabase
      .from('events')
      .select('*')
      .eq('game_id', game.id)
      .eq('is_active', true)
      .gte('end_date', new Date(now).toISOString())
      .order('end_date', { ascending: true })
      .limit(20),
    supabase
      .from('checklist_items')
      .select('*')
      .eq('game_id', game.id)
      .order('sort_order'),
  ])

  const rows = events ?? []

  // Lo anunciado va aparte de lo que ya se puede jugar. La wiki lista las dos
  // cosas en la misma tabla y sin separarlas la cabecera contaba como activos
  // eventos que aún no han llegado.
  const activeEvents = rows.filter(
    (e) => phaseAt(e.start_date, e.end_date, now) === 'live'
  )
  const upcomingEvents = rows
    .filter((e) => phaseAt(e.start_date, e.end_date, now) === 'upcoming')
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
  const weeklyEvents = rows.filter((e) => e.kind === 'weekly')

  return (
    <main className="mx-auto max-w-lg px-4 pb-10">
      <PageHeader
        title={game.name}
        accentColor={game.color_accent}
        meta={`${activeEvents.length} ${
          activeEvents.length === 1 ? t.game.activeOne : t.game.activeMany
        }`}
      />

      <SubNav slug={game.slug} active="events" labels={t.game} />

      <div className="space-y-9">
        <section>
          <h2 className="eyebrow mb-3">{t.game.eventsHeading}</h2>
          {activeEvents.length === 0 ? (
            <p className="text-sm text-dim">{t.game.noEvents}</p>
          ) : (
            <div>
              {activeEvents.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  accentColor={game.color_accent}
                  locale={locale}
                  words={t.urgency}
                  andMore={t.event.andMore}
                />
              ))}
            </div>
          )}
        </section>

        {upcomingEvents.length > 0 && (
          <section>
            <h2 className="eyebrow mb-3">{t.game.upcomingHeading}</h2>
            <p className="-mt-1 mb-3 text-xs text-[var(--text-faint)]">
              {t.game.upcomingNote}
            </p>
            <div>
              {upcomingEvents.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  accentColor={game.color_accent}
                  upcoming
                  locale={locale}
                  words={t.urgency}
                  andMore={t.event.andMore}
                />
              ))}
            </div>
          </section>
        )}

        {/* Eventos semanales repetitivos: Cyclical Extrapolation, etc. */}
        {weeklyEvents.length > 0 && (
          <section>
            <h2 className="eyebrow mb-3">{t.game.weeklyHeading}</h2>
            <div>
              {weeklyEvents.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  accentColor={game.color_accent}
                  locale={locale}
                  words={t.urgency}
                  andMore={t.event.andMore}
                />
              ))}
            </div>
          </section>
        )}

        <ChecklistSection
          items={checklistItems ?? []}
          gameSlug={game.slug}
          accentColor={game.color_accent}
          locale={locale}
          labels={t.game}
        />
      </div>
    </main>
  )
}
