'use client'

import { useCallback, useMemo, useState } from 'react'
import { create } from 'zustand'
import { useClock } from '@/lib/use-clock'
import { timelineAt, urgencyColor } from '@/lib/urgency'
import type { Dictionary } from '@/lib/i18n'

interface Game {
  slug: string
  name: string
  color_accent: string
}

interface WeeklyEvent {
  id: string
  title: string
  kind: string
  is_active: boolean
  image_url: string | null
  start_date: string
  end_date: string
  games: { slug: string; name: string; color_accent: string } | null
}

interface CiclicosBoardProps {
  events: any[]
  games: Game[]
  locale: Dictionary['ciclicos']
}

interface FilterStore {
  selected: Set<string>
  toggle: (slug: string) => void
  setAll: (slugs: string[]) => void
}

const useFilterStore = create<FilterStore>((set) => ({
  selected: new Set<string>(),
  toggle: (slug) =>
    set((state) => {
      const next = new Set(state.selected)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return { selected: next }
    }),
  setAll: (slugs) => set({ selected: new Set(slugs) }),
}))

export function CiclicosBoard({ events, games, locale }: CiclicosBoardProps) {
  const now = useClock()
  const { selected, toggle, setAll } = useFilterStore()
  const [pickerOpen, setPickerOpen] = useState(false)

  const eventsByGame = useMemo(() => {
    const acc: Record<string, WeeklyEvent[]> = {}
    for (const event of events) {
      const slug = event.games?.slug ?? 'unknown'
      if (!acc[slug]) acc[slug] = []
      acc[slug].push(event)
    }
    return acc
  }, [events])

  const filteredGames = useMemo(() => {
    if (selected.size === 0) return []
    return games.filter((g) => selected.has(g.slug) && eventsByGame[g.slug]?.length)
  }, [games, selected, eventsByGame])

  const handleToggle = useCallback(
    (slug: string) => {
      toggle(slug)
      const newSelected = new Set(selected)
      if (newSelected.has(slug)) newSelected.delete(slug)
      else newSelected.add(slug)
      if (newSelected.size === 0) setPickerOpen(true)
    },
    [selected, toggle],
  )

  const handleSelectAll = useCallback(() => {
    setAll(games.map((g) => g.slug))
    setPickerOpen(false)
  }, [games, setAll])

  const handleDone = useCallback(() => {
    if (selected.size === 0) {
      setAll(games.map((g) => g.slug))
    }
    setPickerOpen(false)
  }, [selected.size, games, setAll])

  if (selected.size === 0 && !pickerOpen) {
    setPickerOpen(true)
  }

  return (
    <>
      <div className="mb-6">
        <button
          onClick={() => setPickerOpen(true)}
          className="flex items-center gap-2 rounded-sm border border-line bg-panel px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted/50"
        >
          <span className="text-lg leading-none">+</span>
          <span>{locale.addGames}</span>
          {selected.size > 0 && (
            <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-background">
              {selected.size}
            </span>
          )}
        </button>
      </div>

      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95">
          <div className="w-full max-w-md rounded-sm border border-line bg-panel p-6">
            <h2 className="mb-4 text-lg font-semibold text-foreground">{locale.pickerTitle}</h2>
            <div className="space-y-2">
              {games.map((game) => {
                const isSelected = selected.has(game.slug)
                return (
                  <button
                    key={game.slug}
                    onClick={() => handleToggle(game.slug)}
                    className="flex w-full items-center gap-3 rounded-sm border border-line px-4 py-3 text-left transition-colors hover:bg-muted/50"
                  >
                    <span
                      className="h-4 w-4 shrink-0 rounded-sm border-2"
                      style={{
                        borderColor: game.color_accent,
                        backgroundColor: isSelected ? game.color_accent : 'transparent',
                      }}
                    />
                    <span className="flex-1 text-sm text-foreground">{game.name}</span>
                  </button>
                )
              })}
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={handleSelectAll}
                className="flex-1 rounded-sm border border-line px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted/50"
              >
                Todos
              </button>
              <button
                onClick={handleDone}
                className="flex-1 rounded-sm bg-accent px-4 py-2 text-sm text-background transition-colors hover:bg-accent/90"
              >
                {locale.pickerDone}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-8" id="weekly-content">
        {filteredGames.map((game) => (
          <section key={game.slug}>
            <div className="mb-3 flex items-center gap-2">
              <span
                className="h-2.5 w-[3px] shrink-0"
                style={{ backgroundColor: game.color_accent }}
                aria-hidden="true"
              />
              <h2 className="eyebrow">{game.name}</h2>
            </div>
            <div className="space-y-2">
              {(eventsByGame[game.slug] ?? []).map((item) => {
                const cd = now === 0 ? null : timelineAt(item.start_date, item.end_date, now)
                const isLive = cd?.phase === 'live'
                const isUpcoming = cd?.phase === 'upcoming'
                const isEnded = cd?.level === 'ended'

                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-sm border border-line bg-panel px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="block text-sm text-foreground">{item.title}</span>
                      {cd && !isEnded && (
                        <span
                          className="mt-0.5 block text-xs tabular"
                          style={{ color: urgencyColor(cd.level) }}
                        >
                          {isLive
                            ? `${locale.renewsIn} ${cd.label}`
                            : isUpcoming
                              ? `${locale.startsIn} ${cd.label}`
                              : cd.label}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      {filteredGames.length === 0 && !pickerOpen && (
        <p className="text-sm text-dim">{locale.empty}</p>
      )}
    </>
  )
}
