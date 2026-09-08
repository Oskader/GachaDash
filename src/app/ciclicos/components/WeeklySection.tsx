'use client'

import { CountdownLabel } from '@/components/ui/countdown'
import { Checkbox } from '@/components/ui/checkbox'
import { useClock } from '@/lib/use-clock'
import { weeklyWindowAt } from '@/lib/urgency'
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

/**
 * Checklist semanal de un juego, con temporizador.
 *
 * El estado vive en localStorage atado al PERIODO semanal (ver
 * `weeklyWindowAt`): cuando la semana cambia, las marcas expiran solas y el
 * checklist arranca vacío — eso es el "temporizador" trabajando, no hay
 * código de limpieza. Sin cuenta, el progreso de la semana pasada se
 * quedaría marcado para siempre.
 *
 * El progreso se calcula por juego (`n/m`) en la cabecera; la cuenta atrás
 * de cada fila es la del propio evento, y la del RENUEVO semanal vive en la
 * mecha de la página, no aquí.
 */
export function WeeklySection({ events, accentColor, gameName, labels, words }: Props) {
  const now = useClock()
  // `now === 0` = aún sin montar en cliente: sin periodo no se lee marca
  // ninguna y la hidratación coincide con el servidor.
  const periodId = now === 0 ? null : weeklyWindowAt(now).periodId
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
                {/* Cuenta atrás del evento en sí: hasta su arranque si
                    todavía no empezó (con la flecha de "empieza en"), hasta
                    su final si está en marcha. */}
                <CountdownLabel
                  startDate={event.start_date}
                  endDate={event.end_date}
                  className="shrink-0"
                  words={words}
                />
              </label>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
