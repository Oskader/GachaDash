import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/page-header'
import { EventRow } from '@/components/event-row'
import { SubNav } from '../components/SubNav'
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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { game: slug } = await params
  const { t } = await getI18n()
  const game = await getGame(slug)

  if (!game) return { title: t.game.notFound }

  return {
    title: `${game.name} — ${t.game.bannersTitle}`,
    description: t.game.bannersNote,
  }
}

export default async function BannersPage({ params }: Props) {
  const { game: gameSlug } = await params
  const { locale, t } = await getI18n()
  const supabase = await createClient()
  const now = requestNow()

  const game = await getGame(gameSlug)
  if (!game) notFound()

  // Pausado: el SubNav ya oculta el link, pero el acceso directo por URL
  // muestra el placeholder en vez de notFound().
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

  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('game_id', game.id)
    .eq('is_active', true)
    .eq('kind', 'banner')
    .gte('end_date', new Date(now).toISOString())
    .order('end_date', { ascending: true })

  const rows = events ?? []

  const activeBanners = rows.filter(
    (e) => phaseAt(e.start_date, e.end_date, now) === 'live'
  )
  const upcomingBanners = rows
    .filter((e) => phaseAt(e.start_date, e.end_date, now) === 'upcoming')
    .sort((a, b) => a.start_date.localeCompare(b.start_date))

  return (
    <main className="mx-auto max-w-lg px-4 pb-10">
      <PageHeader
        title={game.name}
        accentColor={game.color_accent}
        meta={`${activeBanners.length} ${
          activeBanners.length === 1 ? t.game.activeOne : t.game.activeMany
        }`}
      />

      <SubNav slug={game.slug} active="banners" labels={t.game} />

      <div className="space-y-9">
        <section>
          <h2 className="eyebrow mb-3">{t.game.bannersTitle}</h2>
          {activeBanners.length === 0 ? (
            <p className="text-sm text-dim">{t.game.noBanners}</p>
          ) : (
            <div>
              {activeBanners.map((event) => (
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

        {upcomingBanners.length > 0 && (
          <section>
            <h2 className="eyebrow mb-3">{t.game.upcomingHeading}</h2>
            <p className="-mt-1 mb-3 text-xs text-[var(--text-faint)]">
              {t.game.upcomingNote}
            </p>
            <div>
              {upcomingBanners.map((event) => (
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
      </div>
    </main>
  )
}
