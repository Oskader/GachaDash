'use client'

import { useOptimistic, useTransition } from 'react'
import { toast } from 'sonner'
import { Checkbox } from '@/components/ui/checkbox'
import { CountdownLabel } from '@/components/ui/countdown'
import { toggleChecklistItem } from '../actions'
import { pickTitle, type Dictionary, type Locale } from '@/lib/i18n/shared'
import type { Database } from '@/lib/supabase/types'

type ChecklistItemRow = Database['public']['Tables']['checklist_items']['Row']

interface Props {
  items: ChecklistItemRow[]
  completedIds: string[]
  accentColor: string
  locale: Locale
  labels: Dictionary['game']
  isSignedIn: boolean
  gameName: string
}

export function ChecklistClient({
  items,
  completedIds,
  accentColor,
  isSignedIn,
  locale,
  labels,
  gameName,
}: Props) {
  const [, startTransition] = useTransition()

  const [optimistic, addOptimistic] = useOptimistic(
    completedIds,
    (current: string[], itemId: string) =>
      current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId]
  )

  const completedSet = new Set(optimistic)

  function toggle(itemId: string) {
    if (!isSignedIn) return

    const willBeCompleted = !completedSet.has(itemId)

    startTransition(async () => {
      addOptimistic(itemId)
      const result = await toggleChecklistItem(itemId, willBeCompleted)
      if (!result.ok) toast.error(result.error ?? labels.saveFailed)
    })
  }

  const done = completedSet.size
  const total = items.length
  const percent = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <section aria-labelledby={`checklist-heading-${gameName}`}>
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2
          id={`checklist-heading-${gameName}`}
          className="eyebrow flex-1 items-center gap-2"
        >
          <span
            className="h-2.5 w-[3px] shrink-0"
            style={{ backgroundColor: accentColor }}
            aria-hidden="true"
          />
          {gameName}
        </h2>
        <span className="tabular text-sm text-dim">
          <span style={{ color: done > 0 ? accentColor : undefined }}>{done}</span>
          <span className="text-[var(--text-faint)]">/{total}</span>
        </span>
      </div>

      <div
        className="mb-5 h-[3px] w-full bg-line"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${labels.progressAria}: ${done}/${total}`}
      >
        <div
          className="h-full transition-[width] duration-500 ease-out"
          style={{ width: `${percent}%`, backgroundColor: accentColor }}
        />
      </div>

      <ul className="divide-y divide-line border-y border-line">
        {items.map((item) => {
          const isDone = completedSet.has(item.id)
          const hasDates = item.start_date && item.end_date
          return (
            <li key={item.id}>
              <label
                className={`flex cursor-pointer items-center gap-3 py-3 transition-colors ${
                  isSignedIn ? 'hover:bg-panel' : 'cursor-not-allowed'
                }`}
              >
                <Checkbox
                  checked={isDone}
                  onCheckedChange={() => toggle(item.id)}
                  disabled={!isSignedIn}
                  className="size-[18px] rounded-[2px] border-line-strong data-[state=checked]:border-transparent"
                  style={
                    isDone
                      ? { backgroundColor: accentColor, color: 'var(--ink)' }
                      : undefined
                  }
                />
                <span
                  className={`flex-1 text-sm leading-snug transition-colors ${
                    isDone ? 'text-[var(--text-faint)] line-through' : 'text-foreground'
                  }`}
                >
                  {pickTitle(item, locale)}
                </span>
                {hasDates && !isDone && (
                  <CountdownLabel
                    startDate={item.start_date!}
                    endDate={item.end_date!}
                    className="shrink-0 text-xs"
                  />
                )}
                <span
                  className="tabular shrink-0 text-[10px] uppercase tracking-wider text-dim"
                  aria-hidden="true"
                >
                  {labels.categories[item.category] ?? item.category}
                </span>
              </label>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
