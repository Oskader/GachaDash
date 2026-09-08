/**
 * Urgencia: la única fuente de verdad sobre cuánto queda y cómo se pinta.
 *
 * El color saturado de la app codifica urgencia y nada más, así que este
 * módulo es el que decide qué se ve rojo. Vive aparte de los componentes
 * para que el servidor y el cliente calculen exactamente lo mismo.
 */

export type UrgencyLevel = 'none' | 'low' | 'mid' | 'high' | 'ended'

/**
 * En qué momento de su propia ventana está el evento.
 *
 * Hace falta porque las wikis listan también lo que **todavía no ha
 * empezado** (la sección `Upcoming`), y una fila así contada como activa
 * miente dos veces: aparece entre lo que se te está acabando, y su cuenta
 * atrás es la de su final, no la de su llegada. Planar Fissure dura 14 días
 * y salía marcando 27.
 */
export type EventPhase = 'upcoming' | 'live' | 'ended'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

export interface Countdown {
  level: UrgencyLevel
  /** Milisegundos restantes; 0 si ya terminó. */
  remaining: number
  /** "2d 04h" / "06h 12m" / "14m". Vacío si terminó. */
  label: string
  /** Etiqueta larga para lectores de pantalla. */
  srLabel: string
}

export function levelFor(remainingMs: number): UrgencyLevel {
  if (remainingMs <= 0) return 'ended'
  if (remainingMs < 12 * HOUR) return 'high'
  if (remainingMs < 2 * DAY) return 'mid'
  if (remainingMs < 7 * DAY) return 'low'
  return 'none'
}

/** Variable CSS del color correspondiente al nivel. */
export function urgencyColor(level: UrgencyLevel): string {
  switch (level) {
    case 'high':
      return 'var(--urgency-high)'
    case 'mid':
      return 'var(--urgency-mid)'
    case 'low':
      return 'var(--urgency-low)'
    case 'ended':
      return 'var(--text-faint)'
    default:
      return 'var(--urgency-none)'
  }
}

export function formatRemaining(remainingMs: number): string {
  if (remainingMs <= 0) return ''

  const days = Math.floor(remainingMs / DAY)
  const hours = Math.floor((remainingMs % DAY) / HOUR)
  const minutes = Math.floor((remainingMs % HOUR) / (60 * 1000))

  const pad = (n: number) => String(n).padStart(2, '0')

  if (days > 0) return `${days}d ${pad(hours)}h`
  if (hours > 0) return `${pad(hours)}h ${pad(minutes)}m`
  return `${minutes}m`
}

/**
 * Palabras de la etiqueta para lectores de pantalla.
 *
 * Solo esta es traducible: el texto VISIBLE de la cuenta atrás ("2d 03h",
 * "06h 41m") es neutro y no cambia de idioma. Son plantillas enteras y no
 * palabras sueltas porque el orden cambia: "Quedan 3 días y 5 h" contra
 * "3 days and 5 h left".
 */
export interface UrgencyWords {
  ended: string
  withDays: string
  withHours: string
  lessThanHour: string
  day: string
  days: string
  /** Cuenta atrás hasta el ARRANQUE, para lo que aún no ha empezado. */
  startsInDays: string
  startsInHours: string
  startsInSoon: string
}

const DEFAULT_WORDS: UrgencyWords = {
  ended: 'Terminado',
  withDays: 'Quedan {d} {dayWord} y {h} h',
  withHours: 'Quedan {h} h',
  lessThanHour: 'Quedan menos de una hora',
  day: 'día',
  days: 'días',
  startsInDays: 'Empieza en {d} {dayWord} y {h} h',
  startsInHours: 'Empieza en {h} h',
  startsInSoon: 'Empieza en menos de una hora',
}

function srFormat(remainingMs: number, w: UrgencyWords): string {
  if (remainingMs <= 0) return w.ended
  const days = Math.floor(remainingMs / DAY)
  const hours = Math.floor((remainingMs % DAY) / HOUR)
  if (days > 0) {
    return w.withDays
      .replace('{d}', String(days))
      .replace('{dayWord}', days === 1 ? w.day : w.days)
      .replace('{h}', String(hours))
  }
  if (hours > 0) return w.withHours.replace('{h}', String(hours))
  return w.lessThanHour
}

function startFormat(remainingMs: number, w: UrgencyWords): string {
  const days = Math.floor(remainingMs / DAY)
  const hours = Math.floor((remainingMs % DAY) / HOUR)
  if (days > 0) {
    return w.startsInDays
      .replace('{d}', String(days))
      .replace('{dayWord}', days === 1 ? w.day : w.days)
      .replace('{h}', String(hours))
  }
  if (hours > 0) return w.startsInHours.replace('{h}', String(hours))
  return w.startsInSoon
}

/**
 * `now` es un parámetro obligatorio a propósito: leer el reloj dentro de
 * un render hace que servidor y cliente produzcan HTML distinto.
 */
export function countdownAt(
  endDate: string,
  now: number,
  words: UrgencyWords = DEFAULT_WORDS
): Countdown {
  const end = Date.parse(endDate)
  const remaining = Number.isNaN(end) ? 0 : Math.max(0, end - now)

  return {
    level: levelFor(remaining),
    remaining,
    label: formatRemaining(remaining),
    srLabel: srFormat(remaining, words),
  }
}

/**
 * Fase del evento respecto a `now`.
 *
 * Una fecha ilegible cae en 'live': la fila se ve con su cuenta atrás en vez
 * de esconderse en una sección de futuro que nunca llegaría.
 */
export function phaseAt(
  startDate: string | null | undefined,
  endDate: string,
  now: number
): EventPhase {
  const end = Date.parse(endDate)
  if (!Number.isNaN(end) && end <= now) return 'ended'
  // Sin fecha de inicio no se puede afirmar que algo esté por llegar, así que
  // se trata como en marcha. Al revés se escondería en una sección de futuro
  // de la que no saldría nunca.
  if (!startDate) return 'live'
  const start = Date.parse(startDate)
  if (!Number.isNaN(start) && start > now) return 'upcoming'
  return 'live'
}

export interface Timeline extends Countdown {
  phase: EventPhase
}

/**
 * Cuenta atrás consciente de la fase: hasta el final si el evento está en
 * marcha, hasta el arranque si todavía no ha empezado.
 *
 * Lo que aún no ha empezado sale SIEMPRE en gris, y eso no es un descuido:
 * el color saturado de esta app significa "se te acaba", y a un evento que
 * no ha llegado no se le acaba nada. Pintar de rojo algo que empieza en diez
 * horas rompería la única regla que sostiene el sistema visual.
 */
export function timelineAt(
  startDate: string | null | undefined,
  endDate: string,
  now: number,
  words: UrgencyWords = DEFAULT_WORDS
): Timeline {
  const phase = phaseAt(startDate, endDate, now)

  if (phase !== 'upcoming' || !startDate) {
    return { phase, ...countdownAt(endDate, now, words) }
  }

  const remaining = Math.max(0, Date.parse(startDate) - now)
  return {
    phase,
    level: 'none',
    remaining,
    label: formatRemaining(remaining),
    srLabel: startFormat(remaining, words),
  }
}

/**
 * Fracción de la ventana del evento ya consumida, de 0 a 1.
 * Es lo que dibuja la mecha: no es progreso global, es "cuánto se ha
 * quemado de ESTE evento".
 */
export function burnedFraction(
  startDate: string,
  endDate: string,
  now: number
): number {
  const start = Date.parse(startDate)
  const end = Date.parse(endDate)
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0
  return Math.min(1, Math.max(0, (now - start) / (end - start)))
}

/**
 * El reinicio semanal de los cuatro juegos: lunes a las 04:00.
 *
 * Los servidores de cada juego reinician el lunes de madrugada en SU hora
 * local; aquí se usa la del visitante como aproximación de la de su
 * servidor, que para el caso típico (juega en la región de su huso) es
 * exacta. La página enseña la fecha y hora completas, así que un desfase
 * sería visible y corregible cambiando estas dos constantes.
 */
const RESET_DAY = 1 // lunes (getDay(): 0 domingo … 6 sábado)
const RESET_HOUR = 4

export interface WeeklyWindow {
  /**
   * Identificador estable del periodo: el instante del PRÓXIMO reinicio en
   * ISO. Dos clientes en la misma semana producen la misma cadena, y cuando
   * la semana cambia la cadena cambia con ella — es la clave con la que el
   * checklist sabe que toca vaciarse.
   */
  periodId: string
  /** Inicio del periodo (el reinicio anterior), en ms. */
  start: number
  /** El próximo reinicio, en ms. */
  end: number
}

/** Ventana semanal vigente en `now` (ms). Determinista, sin efectos. */
export function weeklyWindowAt(now: number): WeeklyWindow {
  const end = new Date(now)
  end.setDate(end.getDate() + ((RESET_DAY - end.getDay() + 7) % 7))
  end.setHours(RESET_HOUR, 0, 0, 0)
  // Lunes 04:00 ya pasado el minuto: el próximo reinicio es el de la semana
  // siguiente, no el que acabó de pasar.
  if (end.getTime() <= now) end.setDate(end.getDate() + 7)

  const endMs = end.getTime()
  return {
    periodId: end.toISOString(),
    start: endMs - 7 * DAY,
    end: endMs,
  }
}

/**
 * Lectura del reloj para Server Components.
 *
 * En un RSC dinámico esto se evalúa una vez por petición, no en un ciclo de
 * render, así que es legítimo. Vive en una función aparte para que quede
 * explícito que es una lectura por request y no un render impuro.
 */
export function requestNow(): number {
  return Date.now()
}
