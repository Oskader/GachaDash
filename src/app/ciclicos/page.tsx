import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/page-header'
import { getI18n } from '@/lib/i18n'
import { CiclicosBoard } from './components/CiclicosBoard'
import { ChecklistSection } from './components/ChecklistSection'
import type { Database } from '@/lib/supabase/types'

type GameRow = Pick<
  Database['public']['Tables']['games']['Row'],
  'id' | 'slug' | 'name' | 'color_accent'
>
type ChecklistItemRow = Database['public']['Tables']['checklist_items']['Row']

/** Lo que la página necesita de un evento semanal; nada más viaja al cliente. */
interface WeeklyEvent {
  id: string
  title: string
  start_date: string
  end_date: string
  games: { slug: string; name: string; color_accent: string } | null
}

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n()
  return {
    title: t.ciclicos.title,
    description: t.ciclicos.metaDescription,
  }
}

export default async function CiclicosPage() {
  const { locale, t } = await getI18n()
  const supabase = await createClient()

  const [eventsResult, gamesResult, checklistResult, auth] = await Promise.all([
    supabase
      .from('events')
      .select('id, title, start_date, end_date, games(slug, name, color_accent)')
      .eq('is_active', true)
      .eq('kind', 'weekly')
      .order('end_date', { ascending: true }),
    supabase.from('games').select('id, slug, name, color_accent').order('name'),
    supabase.from('checklist_items').select('*').order('sort_order'),
    // Un único getUser() para el aviso de sesión. Cada ChecklistSection
    // sigue verificando el suyo: getUser() valida el JWT contra el servidor
    // de auth y no se sustituye por getSession().
    supabase.auth.getUser(),
  ])

  // El recorte de columnas con embed no lo refleja el tipo generado, así
  // que se declara la forma real de lo que pide el select.
  const weeklyEvents = (eventsResult.data ?? []) as unknown as WeeklyEvent[]
  const games = (gamesResult.data ?? []) as GameRow[]
  const checklistItems = (checklistResult.data ?? []) as ChecklistItemRow[]
  const user = auth.data.user

  // Semanales agrupados por juego, en el orden canónico de `games`.
  const weekly = games.map((game) => ({
    slug: game.slug,
    name: game.name,
    color_accent: game.color_accent,
    events: weeklyEvents
      .filter((event) => event.games?.slug === game.slug)
      .map(({ id, title, start_date, end_date }) => ({ id, title, start_date, end_date })),
  }))

  // Endgame: un nodo por juego, ya renderizado en servidor. El filtro de
  // cliente solo decide cuáles se enseñan — aquí no hay estado que mover.
  const gameIdToSlug = new Map(games.map((game) => [game.id, game.slug]))
  const checklistByGame = new Map<string, ChecklistItemRow[]>()
  for (const item of checklistItems) {
    const slug = gameIdToSlug.get(item.game_id)
    if (!slug) continue
    const list = checklistByGame.get(slug) ?? []
    list.push(item)
    checklistByGame.set(slug, list)
  }

  const endgame = games
    .filter((game) => (checklistByGame.get(game.slug)?.length ?? 0) > 0)
    .map((game) => ({
      slug: game.slug,
      node: (
        <ChecklistSection
          items={checklistByGame.get(game.slug) ?? []}
          accentColor={game.color_accent}
          locale={locale}
          labels={t.game}
          gameName={game.name}
        />
      ),
    }))

  // Un solo aviso de sesión para la página entera, no uno por juego.
  const signInNotice = user ? null : (
    <p className="mt-8 border border-line bg-panel px-4 py-3 text-sm text-dim">
      <Link
        href="/login?next=/ciclicos"
        className="font-medium text-foreground underline underline-offset-4 hover:text-[var(--urgency-low)]"
      >
        {t.game.signInLink}
      </Link>{' '}
      {t.game.signInRest}
    </p>
  )

  return (
    <main className="mx-auto max-w-lg px-4 pb-24">
      {/* Sin stripe de acento: la identidad de esta página es el ciclo de la
          semana, que anuncia la cabecera de Semanales. */}
      <PageHeader
        title={t.ciclicos.title}
        meta={`${weeklyEvents.length} ${t.ciclicos.events}`}
      />

      <CiclicosBoard
        games={games}
        weekly={weekly}
        endgame={endgame}
        signInNotice={signInNotice}
        labels={t.ciclicos}
        words={t.urgency}
      />
    </main>
  )
}
