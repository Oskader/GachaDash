'use client'

import { useState, useCallback } from 'react'
import { useClock } from '@/lib/use-clock'
import { timelineAt, urgencyColor } from '@/lib/urgency'
import type { Dictionary } from '@/lib/i18n'

interface WeeklySectionProps {
  events: any[]
  accentColor: string
  gameName: string
  locale: Dictionary['game']
}

/**
 * Sección "Semanal" con checklist local para eventos repetitivos.
 * El estado se persiste en localStorage y se resetea cuando el evento termina.
 * Muestra un temporizador de cuenta atras hasta el proximo reset.
 */
export function WeeklySection({ events, accentColor, gameName }: WeeklySectionProps) {
  const now = useClock()
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

  if (events.length === 0) return null

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span className="h-2.5 w-[3px] shrink-0" style={{ backgroundColor: accentColor }} aria-hidden="true" />
        <h2 className="eyebrow">{gameName}</h2>
      </div>
      <div className="space-y-2">
        {events.map((item: any) => {
          const isCompleted = completed.has(item.id)
          const cd = now === 0 ? null : timelineAt(item.start_date, item.end_date, now)
          const isLive = cd?.phase === 'live'
          const isUpcoming = cd?.phase === 'upcoming'
          const isEnded = cd?.level === 'ended'

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
              <div className="min-w-0 flex-1">
                <span
                  className={`block text-sm ${
                    isCompleted ? 'text-muted-foreground line-through' : 'text-foreground'
                  }`}
                >
                  {item.title}
                </span>
                {cd && !isEnded && (
                  <span
                    className="mt-0.5 block text-xs tabular"
                    style={{ color: urgencyColor(cd.level) }}
                  >
                    {isLive ? `Se renueva en ${cd.label}` : isUpcoming ? `Empieza en ${cd.label}` : cd.label}
                  </span>
                )}
              </div>
            </label>
          )
        })}
      </div>
    </section>
  )
}
