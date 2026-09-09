import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/page-header'
import { getI18n } from '@/lib/i18n'
import { isPausedGame } from '@/lib/game-status'
import { countdownAt, phaseAt, requestNow, urgencyColor } from '@/lib/urgency'

export const metadata: Metadata = { title: 'Juegos' }

export default async function JuegosPage() {
  const { t } = await getI18n()
  const supabase = await createClient()
  const now = requestNow()

  const [{ data: games }, { data: events }] = await Promise.all([
    supabase
      .from('games')
      .select('id, slug, name, color_accent, icon_url')
      .order('name'),
    supabase
      .from('events')
      .select('game_id, kind, start_date, end_date')
      .eq('is_active', true)
      .gte('end_date', new Date(now).toISOString()),
  ])

  const summary = new Map<
    string,
    { count: number; upcoming: number; soonest: string | null }
  >()
  const pausedIds = new Set(
    (games ?? []).filter((g) => isPausedGame(g.slug)).map((g) => g.id)
  )
  for (const event of events ?? []) {
    if (pausedIds.has(event.game_id)) continue
    if (event.kind === 'weekly') continue
    const entry =
      summary.get(event.game_id) ?? { count: 0, upcoming: 0, soonest: null }

    if (phaseAt(event.start_date, event.end_date, now) === 'upcoming') {
      entry.upcoming += 1
    } else {
      entry.count += 1
      if (!entry.soonest || event.end_date < entry.soonest) {
        entry.soonest = event.end_date
      }
    }
    summary.set(event.game_id, entry)
  }

  return (
    <main className="mx-auto max-w-lg px-4 pb-10">
      <PageHeader title={t.juegos.title} meta={`${games?.length ?? 0} ${t.juegos.tracked}`} />

      <ul className="border-t border-line">
        {games?.map((game) => {
          const stats = summary.get(game.id)
          const cd = stats?.soonest ? countdownAt(stats.soonest, now, t.urgency) : null
          const paused = isPausedGame(game.slug)

          return (
            <li key={game.id} className="border-b border-line">
              <Link
                href={`/${game.slug}`}
                className="group flex items-center gap-4 py-4 transition-colors hover:bg-panel"
              >
                {game.icon_url ? (
                  <Image
                    src={game.icon_url}
                    alt=""
                    width={40}
                    height={40}
                    className="h-10 w-10 shrink-0 rounded-[2px] object-cover"
                    aria-hidden="true"
                  />
                ) : (
                  <span
                    className="h-10 w-10 shrink-0 rounded-[2px]"
                    style={{ backgroundColor: game.color_accent }}
                    aria-hidden="true"
                  />
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {game.name}
                  </p>
                  <p className="tabular mt-0.5 text-[11px] text-dim">
                    {paused
                      ? t.paused.comingSoon
                      : stats?.count
                        ? `${stats.count} ${stats.count === 1 ? t.hoy.activeEvent : t.hoy.activeEvents}`
                        : t.juegos.noActiveEvents}
                    {!paused && stats?.upcoming
                      ? ` · ${(stats.upcoming === 1
                          ? t.juegos.upcomingCountOne
                          : t.juegos.upcomingCount
                        ).replace('{n}', String(stats.upcoming))}`
                      : ''}
                  </p>
                </div>

                {!paused && cd && (
                  <span
                    className="tabular shrink-0 text-sm font-medium"
                    style={{ color: urgencyColor(cd.level) }}
                  >
                    <span aria-hidden="true">{cd.label}</span>
                    <span className="sr-only">
                      {t.juegos.nextClosing}: {cd.srLabel}
                    </span>
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </main>
  )
}
