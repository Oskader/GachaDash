'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import type { Dictionary } from '@/lib/i18n'
import { isPausedGame } from '@/lib/game-status'

interface Game {
  slug: string
  name: string
  color_accent: string
}

interface Props {
  open: boolean
  games: Game[]
  /** Slugs marcados; el padre es el dueño del estado. */
  selected: string[]
  onToggle: (slug: string) => void
  onToggleAll: () => void
  onClose: () => void
  labels: Dictionary['ciclicos']
}

/**
 * "Añadir juegos": elige qué juegos ver en /ciclicos.
 *
 * Diálogo a mano en vez de Radix porque el sistema no quería una dependencia
 * para un único modal: rol, trampa de foco, Escape y bloqueo de scroll se
 * hacen aquí. Hoja inferior en móvil (donde vive esta app) y centrado a
 * partir de `sm`. Sin blur: panel sólido y hairlines, como todo el sistema.
 */
export function GamesModal({ open, games, selected, onToggle, onToggleAll, onClose, labels }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)

  // Escape, trampa de foco, bloqueo de scroll y foco inicial. Todo son
  // efectos sobre el DOM — ningún setState aquí, que es lo que React 19
  // prohíbe dentro de un efecto.
  useEffect(() => {
    if (!open) return

    const previouslyFocused = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // El foco entra al panel: los lectores de pantalla anuncian el diálogo
    // y Tab empieza a ciclar dentro, no por la página de detrás.
    panelRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input, [href], [tabindex]:not([tabindex="-1"])'
      )
      if (!focusables || focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]

      if (event.shiftKey) {
        if (document.activeElement === first || document.activeElement === panelRef.current) {
          event.preventDefault()
          last.focus()
        }
      } else if (document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      {/* Fondo sólido semitransparente, sin blur. Click fuera = cerrar. */}
      <div
        className="animate-in fade-in duration-150 absolute inset-0 bg-black/70"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="games-modal-title"
        tabIndex={-1}
        className="animate-in fade-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200 relative max-h-[80dvh] w-full max-w-sm overflow-y-auto rounded-sm border border-line bg-panel outline-none"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 id="games-modal-title" className="text-sm font-semibold text-foreground">
              {labels.pickerTitle}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-dim">{labels.pickerHelp}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={labels.close}
            className="-mr-1 -mt-1 rounded-sm p-1.5 text-dim transition-colors hover:bg-panel-raised hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <ul className="py-2">
          {games.map((game) => {
            const checked = selected.includes(game.slug)
            // Los pausados (game-status.ts) se enseñan para que se vea que el
            // juego existe, pero sin checkbox: no hay semanales que seguir y
            // dejarles elegir sería prometer una sección vacía.
            const paused = isPausedGame(game.slug)
            return (
              <li key={game.slug}>
                {/* label + Checkbox: el click en toda la fila marca, igual
                    que en el checklist de endgame. */}
                <label
                  className={`flex items-center gap-3 px-5 py-3 transition-colors ${
                    paused ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-panel-raised'
                  }`}
                >
                  {/* Identidad del juego: stripe de 3px, no un swatch */}
                  <span
                    className="h-5 w-[3px] shrink-0"
                    style={{ backgroundColor: game.color_accent, opacity: paused ? 0.4 : 1 }}
                    aria-hidden="true"
                  />
                  <span
                    className={`flex-1 text-sm ${
                      paused ? 'text-[var(--text-faint)]' : 'text-foreground'
                    }`}
                  >
                    {game.name}
                  </span>
                  {paused ? (
                    <span className="tabular shrink-0 text-[10px] uppercase tracking-wider text-dim">
                      {labels.comingSoon}
                    </span>
                  ) : (
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => onToggle(game.slug)}
                      className="size-[18px] shrink-0 rounded-[2px] border-line-strong data-[state=checked]:border-transparent"
                      style={checked ? { backgroundColor: game.color_accent, color: 'var(--ink)' } : undefined}
                    />
                  )}
                </label>
              </li>
            )
          })}
        </ul>

        <div className="flex gap-3 border-t border-line px-5 py-4">
          <button
            type="button"
            onClick={onToggleAll}
            className="flex-1 rounded-sm border border-line px-4 py-2 text-sm text-foreground transition-colors hover:bg-panel-raised"
          >
            {labels.selectAll}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-sm bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
          >
            {labels.pickerDone}
          </button>
        </div>
      </div>
    </div>
  )
}
