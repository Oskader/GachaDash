'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, X } from 'lucide-react'

interface Game {
  slug: string
  name: string
  color_accent: string
}

interface GameFilterProps {
  games: Game[]
}

export function GameFilter({ games }: GameFilterProps) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(() => new Set(games.map((g) => g.slug)))
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const toggle = (slug: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) {
        next.delete(slug)
      } else {
        next.add(slug)
      }
      return next
    })
  }

  const selectedCount = selected.size

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-sm border border-line bg-panel px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted/50"
      >
        <Plus className="h-4 w-4" />
        <span>Añadir juegos</span>
        {selectedCount > 0 && (
          <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-background">
            {selectedCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-64 rounded-sm border border-line bg-panel p-2 shadow-lg">
          <div className="mb-2 flex items-center justify-between px-2">
            <span className="text-xs text-dim">Selecciona juegos</span>
            <button
              onClick={() => setOpen(false)}
              className="text-dim hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-1">
            {games.map((game) => {
              const isSelected = selected.has(game.slug)
              return (
                <button
                  key={game.slug}
                  onClick={() => toggle(game.slug)}
                  className="flex w-full items-center gap-3 rounded-sm px-2 py-2 text-left transition-colors hover:bg-muted/50"
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-sm border-2"
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
        </div>
      )}
    </div>
  )
}
