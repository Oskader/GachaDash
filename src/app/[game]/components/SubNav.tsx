import Link from 'next/link'
import { isPausedGame } from '@/lib/game-status'

interface SubNavProps {
  slug: string
  active: 'events' | 'banners'
  labels: {
    eventsTab: string
    bannersTab: string
  }
}

/**
 * Sub-navegación de segmento dentro de una página de juego.
 *
 * Muestra dos tabs: Eventos | Banners. Se renderiza SOLO en la rama
 * no-pausada de cada página (el early-return de isPausedGame ya existe
 * en ambas), así que un juego en PAUSED_GAMES jamás dibuja el link.
 */
export function SubNav({ slug, active, labels }: SubNavProps) {
  if (isPausedGame(slug)) return null

  return (
    <nav className="mb-6 flex gap-1 border-b border-line" aria-label="Secciones del juego">
      <Link
        href={`/${slug}`}
        className={`px-4 py-2 text-sm font-medium transition-colors ${
          active === 'events'
            ? 'border-b-2 border-accent text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        {labels.eventsTab}
      </Link>
      <Link
        href={`/${slug}/banners`}
        className={`px-4 py-2 text-sm font-medium transition-colors ${
          active === 'banners'
            ? 'border-b-2 border-accent text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        {labels.bannersTab}
      </Link>
    </nav>
  )
}
