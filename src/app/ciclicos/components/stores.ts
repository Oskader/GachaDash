'use client'

import { useMemo, useSyncExternalStore } from 'react'

/**
 * Estado local de /ciclicos que sobrevive a la recarga: qué juegos sigues
 * y qué semanales ya marcaste esta semana.
 *
 * Mismo motivo que `use-clock.ts` para el store externo, y con un tercero
 * propio: React 19 rechaza tanto leer localStorage en el render como
 * sincronizarlo con setState dentro de un efecto. `useSyncExternalStore`
 * es la API prevista — el snapshot de servidor es `null` y coincide con el
 * primer render de cliente, así que la hidratación no se rompe.
 *
 * `null` significa "todavía no hay nada guardado" y cada store le da el
 * sentido que le toca: en los juegos seguidos es "enseñar todos"; en el
 * progreso semanal es "semana sin marcar".
 */

interface Store<T> {
  subscribe: (onStoreChange: () => void) => () => void
  getSnapshot: () => T | null
  getServerSnapshot: () => null
  write: (value: T) => void
}

function localStore<T>(key: string, parse: (raw: string) => T): Store<T> {
  let cache: T | null = null
  let initialized = false
  const listeners = new Set<() => void>()

  // Primera lectura perezosa: getSnapshot debe devolver SIEMPRE la misma
  // referencia hasta que el store emite, así que se lee una vez y se cachea.
  function init() {
    if (initialized) return
    initialized = true
    try {
      const raw = window.localStorage.getItem(key)
      if (raw !== null) cache = parse(raw)
    } catch {
      // localStorage puede estar bloqueado (modo privado, permisos): se vive
      // sin persistencia, el estado dura lo que la página.
    }
  }

  function emit() {
    for (const listener of listeners) listener()
  }

  function subscribe(onStoreChange: () => void) {
    listeners.add(onStoreChange)

    // Otra pestaña movió la misma clave: hay que enterarse o el filtro de
    // este tab se quedaría viejo.
    const onStorage = (event: StorageEvent) => {
      if (event.key !== key) return
      initialized = true
      try {
        cache = event.newValue === null ? null : parse(event.newValue)
      } catch {
        cache = null
      }
      emit()
    }
    window.addEventListener('storage', onStorage)

    return () => {
      listeners.delete(onStoreChange)
      window.removeEventListener('storage', onStorage)
    }
  }

  function write(value: T) {
    cache = value
    initialized = true
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Sin persistencia: el cambio vale para esta sesión igualmente.
    }
    emit()
  }

  return {
    subscribe,
    getSnapshot: () => {
      init()
      return cache
    },
    getServerSnapshot: () => null,
    write,
  }
}

/* ------------------------------------------------------------------ */
/* Juegos seguidos                                                     */
/* ------------------------------------------------------------------ */

const FOLLOWED_KEY = 'gachaevent:followed-games'

function parseSlugs(raw: string): string[] {
  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed)) throw new Error('formato inesperado')
  return parsed.filter((slug): slug is string => typeof slug === 'string')
}

const followedStore = localStore<string[]>(FOLLOWED_KEY, parseSlugs)

/** Juegos que el usuario sigue en /ciclicos. `null` = no ha elegido → todos. */
export function useFollowedGames(): string[] | null {
  return useSyncExternalStore(
    followedStore.subscribe,
    followedStore.getSnapshot,
    followedStore.getServerSnapshot
  )
}

export function setFollowedGames(slugs: string[]): void {
  followedStore.write(slugs)
}

/* ------------------------------------------------------------------ */
/* Progreso del checklist semanal                                      */
/* ------------------------------------------------------------------ */

const WEEKLY_DONE_KEY = 'gachaevent:weekly-done'

interface StoredWeeklyDone {
  period: string
  done: string[]
}

function parseWeeklyDone(raw: string): StoredWeeklyDone {
  const parsed: unknown = JSON.parse(raw)
  const candidate = parsed as Partial<StoredWeeklyDone> | null
  if (
    !candidate ||
    typeof candidate.period !== 'string' ||
    !Array.isArray(candidate.done)
  ) {
    throw new Error('formato inesperado')
  }
  return {
    period: candidate.period,
    done: candidate.done.filter((id): id is string => typeof id === 'string'),
  }
}

const weeklyDoneStore = localStore<StoredWeeklyDone>(WEEKLY_DONE_KEY, parseWeeklyDone)

/**
 * Marcas del checklist semanal, atadas al periodo (ver `weeklyWindowAt`).
 *
 * El temporizador trabaja aquí: cuando la semana cambia, el `period`
 * guardado y el vigente dejan de coincidir y el conjunto se lee vacío — el
 * checklist se vacía solo, sin código de limpieza ni migraciones.
 */
export function useWeeklyDone(periodId: string | null): {
  done: Set<string>
  toggle: (id: string) => void
} {
  const stored = useSyncExternalStore(
    weeklyDoneStore.subscribe,
    weeklyDoneStore.getSnapshot,
    weeklyDoneStore.getServerSnapshot
  )

  const done = useMemo(
    () =>
      new Set(
        periodId !== null && stored?.period === periodId ? stored.done : []
      ),
    [periodId, stored]
  )

  function toggle(id: string) {
    if (periodId === null) return // aún sin cliente montado: nada que marcar

    // Se lee del store, no del render: marcar dos veces seguidas no debe
    // pisarse con un snapshot viejo.
    const current = weeklyDoneStore.getSnapshot()
    const next =
      current?.period === periodId
        ? current.done.includes(id)
          ? current.done.filter((marked) => marked !== id)
          : [...current.done, id]
        : [id]
    weeklyDoneStore.write({ period: periodId, done: next })
  }

  return { done, toggle }
}
