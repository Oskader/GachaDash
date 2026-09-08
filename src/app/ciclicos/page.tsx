import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/page-header'
import { getI18n } from '@/lib/i18n'
import { CiclicosBoard } from './components/CiclicosBoard'
import { ChecklistSection } from '../[game]/components/ChecklistSection'
import type { Database } from '@/lib/supabase/types'

type GameRow = Database['public']['Tables']['games']['Row']
type ChecklistItemRow = Database['public']['Tables']['checklist_items']['Row']

interface WeeklyEvent {
  id: string
  title: string
  kind: string | null
  is_active: boolean
  image_url: string | null
  start_date: string
  end_date: string
  games: { slug: string; name: string; color_accent: string } | null
}

export const metadata: Metadata = {
  title: 'Cíclicos',
  description: 'Rutinas que se repiten: semanales y endgame del ciclo, con checklist.',
}

export default async function CiclicosPage() {
  const { locale, t } = await getI18n()
  const supabase = await createClient()

  const [eventsResult, gamesResult, checklistResult] = await Promise.all([
    supabase
      .from('events')
      .select('id, title, kind, is_active, image_url, start_date, end_date, games(slug, name, color_accent)')
      .eq('is_active', true)
      .eq('kind', 'weekly')
      .order('end_date', { ascending: true }),
    supabase.from('games').select('slug, name, color_accent, id').order('name'),
    supabase.from('checklist_items').select('*').order('sort_order'),
  ])

  const weeklyEvents: any[] = eventsResult.data ?? []
  const games = (gamesResult.data ?? []) as GameRow[]
  const checklistItems = (checklistResult.data ?? []) as ChecklistItemRow[]

  // Mapa de game_id -> slug
  const gameIdToSlug = games.reduce<Record<string, string>>((acc, g) => {
    acc[g.id] = g.slug
    return acc
  }, {})

  // Agrupar checklist items por juego (usando game_id)
  const checklistByGame = checklistItems.reduce<Record<string, ChecklistItemRow[]>>((acc, item) => {
    const slug = gameIdToSlug[item.game_id] ?? 'unknown'
    if (!acc[slug]) acc[slug] = []
    acc[slug].push(item)
    return acc
  }, {})

  return (
    <main className="mx-auto max-w-lg px-4 pb-24">
      <PageHeader title={t.ciclicos.title} meta={`${weeklyEvents?.length ?? 0} ${t.ciclicos.events}`} accentColor="#F59E0B" />

      <CiclicosBoard
        events={weeklyEvents ?? []}
        games={games}
        locale={t.ciclicos}
      />

      {/* Endgames */}
      <div className="mt-12 space-y-8">
        <h2 className="eyebrow">{t.game.checklistHeading}</h2>
        {games
          .filter((game) => checklistByGame[game.slug]?.length)
          .map((game) => (
            <ChecklistSection
              key={game.slug}
              items={checklistByGame[game.slug] ?? []}
              gameSlug={game.slug}
              accentColor={game.color_accent}
              locale={locale}
              labels={t.game}
            />
          ))}
      </div>
    </main>
  )
}
