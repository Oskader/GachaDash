'use client'

import { useState, useEffect } from 'react'
import type { Dictionary } from '@/lib/i18n'

interface WeeklyEvent {
  id: string
  title: string
  is_active: boolean
  image_url: string | null
  start_date: string
  end_date: string
}

interface WeeklySectionProps {
  events: WeeklyEvent[]
  accentColor: string
  gameName: string
  locale: Dictionary['game']
}

/**
 * Sección "Semanal" con checklist local para eventos repetitivos
 * (Cyclical Extrapolation, etc.). El estado se persiste en localStorage
 * y es por-dispositivo (no requiere login, como el endgame).
 */
export function WeeklySection({ events, accentColor, gameName, locale }: WeeklySectionProps) {
  const [completed, setCompleted] = useState<Set<string>>(new Set())

  useEffect(() => {
    const stored = localStorage.getItem('gachaevent-weekly-completed')
    if (stored) {
      try {
        setCompleted(new Set(JSON.parse(stored)))
      } catch {
        // ignore
      }
    }
  }, [])

  const toggle = (id: string) => {
    setCompleted((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      localStorage.setItem('gachaevent-weekly-completed', JSON.stringify([...next]))
      return next
    })
  }

  if (events.length === 0) return null

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span className="h-2.5 w-[3px] shrink-0" style={{ backgroundColor: accentColor }} aria-hidden="true" />
        <h2 className="eyebrow">{gameName}</h2>
      </div>
      <div className="space-y-2">
        {events.map((item) => {
          const isCompleted = completed.has(item.id)
          return (
            <label
              key={item.id}
              className="flex cursor-pointer items-center gap-3 rounded-sm border border-line bg-panel px-4 py-3 transition-colors hover:bg-muted/50"
            >
              <input
                type="checkbox"
                checked={isCompleted}
                onChange={() => toggle(item.id)}
                className="h-4 w-4 shrink-0 accent-[var(--accent)]"
                style={{ accentColor: accentColor } as React.CSSProperties}
              />
              <span
                className={`flex-1 text-sm ${
                  isCompleted ? 'text-muted-foreground line-through' : 'text-foreground'
                }`}
              >
                {item.title}
              </span>
            </label>
          )
        })}
      </div>
    </section>
  )
}
