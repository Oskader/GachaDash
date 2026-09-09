/**
 * Mapeo de nombres de warp (banner) de HSR → nombre de personaje.
 *
 * La wiki de Fandom titula los warps con nombre de evento ("Summer Chorus")
 * pero la app debe mostrar el personaje ("Robin Summeretto"). Este mapa es
 * la fuente canónica inversa. Se extiende revisando Warp/List.
 *
 * Clave: tal cual sale en el <a> de la wiki (post-cleanTitle).
 * Valor: nombre de personaje que mostrar en la app.
 */

export interface ResolvedCharacter {
  /** Nombre del personaje (va en events.title) */
  characterName: string
  /** Nombre original del warp (para logging/debug) */
  bannerTitle: string
  /** true si el personaje se resolvió desde BANNER_TO_CHARACTER */
  mapped: boolean
}

export const BANNER_TO_CHARACTER: Record<string, string> = {
  // Version 4.5 (agosto 2026)
  'Summer Chorus': 'Robin Summeretto',
  'Over the Gilded Tides': 'Aventurine Waveflair',
  'A Hunt Through Night': 'Ashveil',
  'A Rainbow onto Twilight': 'Hyacine',
  // Version 4.4
  'Ad Astra Nova': 'Himeko • Nova',
  'A Star That Lights the Night': 'Sparxie',
  'Indelible Coterie': 'Dan Heng • Permansor Terrae',
  'Coalesced Truths': 'Evernight',
  // ... añadir más según se confirmen
}

/** Inverso: personaje → banner. Útil para logging y deduplicación. */
export const CHARACTER_TO_BANNER: Record<string, string> = Object.fromEntries(
  Object.entries(BANNER_TO_CHARACTER).map(([banner, char]) => [char, banner])
)

/**
 * Resuelve el nombre de personaje desde el título del warp.
 *
 * Estrategia:
 *   1. Búsqueda exacta en BANNER_TO_CHARACTER
 *   2. Búsqueda case-insensitive
 *   3. Fallback: devuelve el original con mapped=false
 *      (mejor mostrar el banner name que nada, se revisa en dry-run)
 */
export function resolveCharacterFromBanner(bannerTitle: string): ResolvedCharacter {
  const cleaned = bannerTitle.trim()

  // 1. Exacta
  if (BANNER_TO_CHARACTER[cleaned]) {
    return {
      characterName: BANNER_TO_CHARACTER[cleaned],
      bannerTitle: cleaned,
      mapped: true,
    }
  }

  // 2. Case-insensitive
  const lower = cleaned.toLowerCase()
  for (const [banner, char] of Object.entries(BANNER_TO_CHARACTER)) {
    if (banner.toLowerCase() === lower) {
      return { characterName: char, bannerTitle: cleaned, mapped: true }
    }
  }

  // 3. Fallback: sin mapear. El runner lo registrará como warning.
  return { characterName: cleaned, bannerTitle: cleaned, mapped: false }
}
