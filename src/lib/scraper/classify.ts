/**
 * Qué es cada evento: banner de gacha, misión, evento de login u otra cosa.
 *
 * La fuente no lo dice: las wikis mezclan banners de personaje, modos de
 * endgame, eventos de login y rutinas de farmeo en la misma lista, y
 * /[game]/banners necesita saber cuáles son banners. La clasificación es
 * heurística —duración + palabras del título—, determinista y revisable.
 * Nada de LLM: el pipeline de extracción sigue sin modelos.
 *
 * Orden de las reglas — primera coincidencia gana:
 *
 *   R0  TITLE_OVERRIDES      corrección manual, gana a la heurística.
 *   R1  keywords de login    fund/anniversary/login/check-in/gift/endgame
 *                            → 'login_event'. Aunque sea corto: "City Fund"
 *                            es acumulación aunque cierre en 12 días.
 *   R2  duración > longDays  → 'login_event'. GANA SOBRE R4 A PROPÓSITO: un
 *                            evento de 30+ días no es un banner en la
 *                            práctica, es acumulación pasiva (pase de
 *                            batalla, fondo de la ciudad, selector
 *                            permanente). Si un banner real de verdad
 *                            superara el umbral, el umbral está mal para ese
 *                            juego y se ajusta en GAME_RULES, no aquí.
 *   R3  keywords de rutina   defense/training → 'mission'. Modos que se
 *                            repiten cada ciclo con nombre propio; nunca
 *                            banners aunque la ventana sea corta.
 *   R4  duración ≤ bannerMaxDays → 'banner'. El default para eventos cortos
 *                            sin keywords: en las cuatro wikis, lo corto y
 *                            sin rótulo de rutina es casi siempre un banner.
 *   R5  resto                → 'mission'.
 *
 * Entre R3 y R4 hay una guarda: fechas que no se pueden interpretar no
 * clasifican — la fila va a 'other' en vez de mentir con un default.
 *
 * La DDL del enum vive en docs/migrations/2026-09-04-add-event-kind.md;
 * hasta que esté aplicada, types.ts lleva el enum a mano (override temporal).
 */

export type EventKind = 'banner' | 'mission' | 'login_event' | 'weekly' | 'other'

/** Umbrales de la heurística, en días. */
export interface GameRules {
  /** Un evento que dura esto o menos, sin keywords de rutina, es un banner. */
  bannerMaxDays: number
  /** Un evento que dura más que esto es acumulación pasiva, no un banner. */
  longDays: number
}

/**
 * Umbrales por juego, calibrados contra los 31 eventos activos del
 * 2026-09-05 (casi todo HSR). La clave 'default' cubre a los demás; Endfield
 * estira sus eventos y además sus tarjetas mezclan banners con eventos
 * especiales, así que lleva override propio.
 */
export const GAME_RULES: Record<string, GameRules> = {
  default: { bannerMaxDays: 25, longDays: 35 },
  'arknights-endfield': { bannerMaxDays: 30, longDays: 45 },
}

/**
 * Correcciones puntuales por título exacto (el ya limpiado y guardado).
 * Aquí vive una corrección, no en la base de datos: el upsert del runner
 * pisa `kind` en cada pasada, así que un UPDATE manual se revierte con el
 * siguiente cron. Se llena tras revisar un dry-run del backfill o del scrape.
 */
export const TITLE_OVERRIDES: Record<string, EventKind> = {}

// 'gift' va en R1 y NO solo en la exclusión: "Gift of Odyssey" ES el evento
// de login diario de HSR. \b para no casar dentro de palabras más largas.
const LOGIN_EVENT_RE = /\b(?:fund|anniversary|login|check.?in|gift|endgame)\b/i

// Rutina repetible con nombre propio: nunca banner aunque la ventana sea
// corta ("Shiyu Defense", "Combat Training").
const NON_BANNER_RE =
  /\b(?:defense|training|fund|anniversary|endgame|login|gift)\b/i

// Evento semanal repetitivo: nunca banner. Va aparte en su propia sección.
const WEEKLY_RE = /\bcyclical\b/i

/** Duración en días fraccionarios; NaN si alguna fecha no se interpreta. */
function durationDays(start_date: string, end_date: string): number {
  return (Date.parse(end_date) - Date.parse(start_date)) / 86_400_000
}

/** Clasifica un evento en su kind. El orden de reglas está en la cabecera. */
export function classifyEvent(
  {
    title,
    start_date,
    end_date,
  }: { title: string; start_date: string; end_date: string },
  gameSlug: string
): EventKind {
  // R0 — corrección manual.
  const override = TITLE_OVERRIDES[title]
  if (override) return override

  const { bannerMaxDays, longDays } = GAME_RULES[gameSlug] ?? GAME_RULES.default
  const days = durationDays(start_date, end_date)

  // R1 — acumulación con nombre propio, aunque sea corta.
  if (LOGIN_EVENT_RE.test(title)) return 'login_event'

  // R2 — larga = pasiva. Gana sobre R4 a propósito (ver cabecera).
  if (days > longDays) return 'login_event'

  // R3 — rutina repetible: nunca banner.
  if (NON_BANNER_RE.test(title)) return 'mission'

  // R3b — evento semanal repetitivo: va en su propia sección.
  if (WEEKLY_RE.test(title)) return 'weekly'

  // Sin duración interpretable no hay decisión posible.
  if (!Number.isFinite(days)) return 'other'

  // R4 — corto y sin rótulo de rutina: banner.
  if (days <= bannerMaxDays) return 'banner'

  // R5 — banda media: evento web / misión.
  return 'mission'
}
