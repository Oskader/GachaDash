'use client'

import { useCallback, useState, type ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { useClock } from '@/lib/use-clock'
import {
  formatRemaining,
  levelFor,
  urgencyColor,
  weeklyWindowAt,
} from '@/lib/urgency'
import type { Dictionary } from '@/lib/i18n'
import { GamesModal } from './GamesModal'
import { WeeklySection, type WeeklyEvent } from './WeeklySection'
import { setFollowedGames, useFollowedGames } from './stores'

export interface CiclicosGameData {
  slug: string
  name: string
  color_accent: string
  events: WeeklyEvent[]
}

interface EndgameSection {
  slug: string
  /** Sección de endgame de un juego, ya renderizada en el servidor. */
  node: ReactNode
}

interface Props {
  games: { slug: string; name: string; color_accent: string }[]
  weekly: CiclicosGameData[]
  endgame: EndgameSection[]
  /** Aviso único de sesión, decidido por el servidor. `null` si hay sesión. */
  signInNotice: ReactNode | null
  labels: Dictionary['ciclicos']
  words: Dictionary['urgency']
}

/**
 * La mecha de la SEMANA: la única mecha de la página.
 *
 * Un evento semanal no se acaba cuando termina su ventana en la wiki, se
 * RENUEVA: lo que caduca de verdad cada semana es el propio ciclo. La mecha
 * firmante mide de lunes 04:00 a lunes 04:00 (ver `weeklyWindowAt`) y a su
 * lado van la cuenta atrás al renuevo y el control "Añadir juegos". Un
 * evento concreto puede durar un parche; la semana no.
 */
function WeekMeter({
  labels,
  children,
}: {
  labels: Dictionary['ciclicos']
  children: ReactNode
}) {
  const now = useClock()
  const week = now === 0 ? null : weeklyWindowAt(now)
  const level = week ? levelFor(week.end - now) : 'none'

  return (
    <div className="mb-6">
      <div className="fuse" role="presentation">
        {week && (
          <div
            className="fuse-burn"
            style={{
              width: `${((now - week.start) / (week.end - week.start)) * 100}%`,
              backgroundColor: urgencyColor(level),
            }}
          />
        )}
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-4">
        {week ? (
          <span
            className="tabular shrink-0 text-sm font-medium"
            style={{ color: urgencyColor(level) }}
          >
            {labels.renewsIn} {formatRemaining(week.end - now)}
          </span>
        ) : (
          // Reserva el hueco con las mismas métricas: sin salto de layout al
          // llegar la hora real, igual que hace CountdownLabel.
          <span className="tabular shrink-0 text-sm text-transparent" aria-hidden="true">
            00d 00h
          </span>
        )}
        {children}
      </div>
    </div>
  )
}

/**
 * Tablero de /ciclicos.
 *
 * El filtro de juegos es de cliente y persiste en localStorage (ver
 * `stores`): decide qué secciones semanales y qué secciones de endgame se
 * ven. Las secciones de endgame llegan ya renderizadas desde el servidor
 * como nodos — el filtro solo elige cuáles enseñar.
 *
 * Sin zustand a propósito: el filtro tiene que sobrevivir a la recarga, y
 * el estado que persiste va por `useSyncExternalStore` para no pelearse con
 * las reglas de pureza de React 19.
 */
export function CiclicosBoard({ games, weekly, endgame, signInNotice, labels, words }: Props) {
  // `null` = nunca eligió → se enseñan todos. `[]` = decidió no seguir
  // ninguno → estado vacío con invitación a elegir.
  const followed = useFollowedGames()
  const [pickerOpen, setPickerOpen] = useState(false)
  const closePicker = useCallback(() => setPickerOpen(false), [])

  const selected = followed ?? games.map((game) => game.slug)

  const toggleGame = (slug: string) => {
    setFollowedGames(
      selected.includes(slug)
        ? selected.filter((marked) => marked !== slug)
        : [...selected, slug]
    )
  }

  const toggleAll = () => {
    // "Todos" restaura el conjunto completo; no borra la elección, que
    // dejaría la página en el estado vacío de "no sigues nada".
    setFollowedGames(games.map((game) => game.slug))
  }

  const visibleWeekly = weekly.filter(
    (section) => selected.includes(section.slug) && section.events.length > 0
  )
  const visibleEndgame = endgame.filter((section) => selected.includes(section.slug))
  const isExplicitlyEmpty = followed !== null && selected.length === 0

  return (
    <>
      <WeekMeter labels={labels}>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={pickerOpen}
          aria-label={labels.gamesAria}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-sm border border-line bg-panel px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-panel-raised"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          {labels.addGames}
          <span className="tabular text-[var(--text-faint)]">
            {selected.length}/{games.length}
          </span>
        </button>
      </WeekMeter>

      {isExplicitlyEmpty ? (
        <div className="border border-line bg-panel px-4 py-10 text-center">
          <h2 className="text-sm font-semibold text-foreground">{labels.emptyTitle}</h2>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-dim">
            {labels.emptyBody}
          </p>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="mt-5 inline-flex items-center gap-2 rounded-sm border border-line-strong px-4 py-2 text-sm text-foreground transition-colors hover:bg-panel-raised"
          >
            <Plus className="size-4" aria-hidden="true" />
            {labels.addGames}
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-8">
            {visibleWeekly.map((section) => (
              <WeeklySection
                key={section.slug}
                events={section.events}
                accentColor={section.color_accent}
                gameName={section.name}
                labels={labels}
                words={words}
              />
            ))}
            {visibleWeekly.length === 0 && (
              <p className="text-sm text-dim">{labels.empty}</p>
            )}
          </div>

          {visibleEndgame.length > 0 && (
            <div className="mt-12 space-y-8">
              <h2 className="eyebrow">{labels.endgameHeading}</h2>
              {visibleEndgame.map((section) => (
                <div key={section.slug}>{section.node}</div>
              ))}
            </div>
          )}

          {signInNotice}
        </>
      )}

      <GamesModal
        open={pickerOpen}
        games={games}
        selected={selected}
        onToggle={toggleGame}
        onToggleAll={toggleAll}
        onClose={closePicker}
        labels={labels}
      />
    </>
  )
}
