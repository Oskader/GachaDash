import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/page-header'
import { getI18n } from '@/lib/i18n'
import { WeeklySection } from './components/WeeklySection'

export const metadata: Metadata = {
  title: 'Semanales',
  description: 'Eventos semanales repetitivos con checklist.',
}

export default async function SemanalesPage() {
  const { t } = await getI18n()
  const supabase = await createClient()

  const [eventsResult, gamesResult] = await Promise.all([
    supabase
      .from('events')
      .select('id, title, kind, is_active, image_url, start_date, end_date, games(slug, name, color_accent)')
      .eq('is_active', true)
      .eq('kind', 'weekly')
      .order('end_date', { ascending: true }),
    supabase.from('games').select('slug, name, color_accent').order('name'),
  ])

  const weeklyEvents = (eventsResult.data ?? []) as any[]
  const games = gamesResult.data ?? []

  // Agrupar eventos por juego
  const eventsByGame = weeklyEvents.reduce((acc: Record<string, any[]>, event: any) => {
    const slug = event.games?.slug ?? 'unknown'
    if (!acc[slug]) acc[slug] = []
    acc[slug].push(event)
    return acc
  }, {})

  return (
    <main className="mx-auto max-w-lg px-4 pb-24">
      <PageHeader title="Semanales" meta={`${weeklyEvents.length} eventos`} accentColor="#F59E0B" />

      {/* Filtro por juego */}
      <div className="mb-6">
        <p className="eyebrow mb-3">Juegos</p>
        <div className="flex flex-wrap gap-2" id="game-filter">
          {games.map((game: any) => (
            <label
              key={game.slug}
              className="flex cursor-pointer items-center gap-2 rounded-sm border border-line bg-panel px-3 py-1.5 transition-colors hover:bg-muted/50"
            >
              <input
                type="checkbox"
                defaultChecked
                className="h-4 w-4 shrink-0 accent-[var(--accent)]"
                style={{ accentColor: game.color_accent } as React.CSSProperties}
                value={game.slug}
                id={`filter-${game.slug}`}
              />
              <span className="text-sm text-foreground">{game.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Eventos semanales agrupados por juego */}
      <div className="space-y-8" id="weekly-content">
        {games
          .filter((game: any) => eventsByGame[game.slug]?.length)
          .map((game: any) => (
            <WeeklySection
              key={game.slug}
              events={eventsByGame[game.slug] ?? []}
              accentColor={game.color_accent}
              gameName={game.name}
              locale={t.game}
            />
          ))}
      </div>
    </main>
  )
}
