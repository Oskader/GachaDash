'use client'

import { useState, useCallback } from 'react'
import type { Database } from '@/lib/supabase/types'
import type { Dictionary } from '@/lib/i18n'

type EventRow = Database['public']['Tables']['events']['Row']

interface WeeklySectionProps {
  items: EventRow[]
  accentColor: string
  locale: Dictionary['game']
}

/**
 * Sección "Semanal" con checklist local para eventos repetitivos
 * (Cyclical Extrapolation, etc.). El estado se persiste en localStorage
 * y es por-dispositivo (no requiere login, como el endgame).
 */
export function WeeklySection({ items, accentColor, locale }: WeeklySectionProps) {
  const [completed, setCompleted] = useState<Set<string>>(new Set())

  const toggle = useCallback((id: string) => {
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
  }, [])

  if (items.length === 0) return null

  return (
    <section>
      <h2 className="eyebrow mb-3">{locale.weeklyHeading}</h2>
      <div className="space-y-2">
        {items.map((item) => {
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
