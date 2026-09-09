'use client'

import { Checkbox } from '@/components/ui/checkbox'
import type { Dictionary } from '@/lib/i18n'
import { useWeeklyDone } from './stores'

export interface WeeklyEvent {
  id: string
  title: string
  start_date: string
  end_date: string
}

interface Props {
  events: WeeklyEvent[]
  accentColor: string
  gameName: string
  labels: Dictionary['ciclicos']
  words: Dictionary['urgency']
}

export function WeeklySection({ events, accentColor, gameName, labels }: Props) {
  const periodId = null // Disable clock reading for now
  const { done, toggle } = useWeeklyDone(periodId)

  if (events.length === 0) return null

  const completed = events.filter((event) => done.has(event.id)).length

  return (
    <section>
      <div className="mb-1 flex items-center gap-2">
        <span
          className="h-2.5 w-[3px] shrink-0"
          style={{ backgroundColor: accentColor }}
          aria-hidden="true"
        />
        <h2 className="eyebrow flex-1">{gameName}</h2>
        <span className="tabular text-sm text-dim">
          <span className="sr-only">{labels.progressAria}: </span>
          {completed}
          <span className="text-[var(--text-faint)]">/{events.length}</span>
        </span>
      </div>

      <ul className="divide-y divide-line border-b border-line">
        {events.map((event) => {
          const isDone = done.has(event.id)
          return (
            <li key={event.id}>
              <label className="flex cursor-pointer items-center gap-3 py-3 transition-colors hover:bg-panel">
                <Checkbox
                  checked={isDone}
                  onCheckedChange={() => toggle(event.id)}
                  className="size-[18px] shrink-0 rounded-[2px] border-line-strong data-[state=checked]:border-transparent"
                  style={
                    isDone ? { backgroundColor: accentColor, color: 'var(--ink)' } : undefined
                  }
                />
                <span
                  className={`flex-1 text-sm leading-snug transition-colors ${
                    isDone ? 'text-[var(--text-faint)] line-through' : 'text-foreground'
                  }`}
                >
                  {event.title}
                </span>
              </label>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
