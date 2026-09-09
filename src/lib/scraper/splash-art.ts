/**
 * Búsqueda automática de splash art para personajes de HSR.
 *
 * Orden de preferencia:
 *   1. Fandom — splash art vía API, tiene personajes pre-release y post-release
 *   2. Prydwen — full art, alta calidad, pero NO tiene pre-release
 *
 * Ninguna lanza: si todo falla, devuelve null y el evento queda sin imagen
 * (el runner lo reporta en el dry-run).
 */

const UA = 'GachaEventBot/1.0 (https://gachaevent.vercel.app)'

/**
 * Prydwen usa un pattern de URL predecible para splash art.
 * Solo para personajes ya lanzados en el juego.
 */
export function prydwenSplashUrl(characterName: string): string | null {
  const slug = characterName
    .toLowerCase()
    .replace(/[''•]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (!slug) return null

  return `https://cdn.prydwen.gg/images/honkai-star-rail/characters/${slug}_full.webp`
}

/**
 * Busca splash art en la wiki de Fandom vía API MediaWiki.
 *
 * Estrategia:
 *   1. Pedir la página del personaje y extraer la lista de imágenes
 *   2. Buscar "Splash art" en los nombres de archivo
 *   3. Resolver la URL directa vía imageinfo
 */
export async function fandomSplashArt(
  characterName: string,
  host: string
): Promise<string | null> {
  try {
    // Paso 1: imágenes en la página del personaje
    const imagesUrl = `https://${host}/api.php?action=parse&page=${encodeURIComponent(characterName)}&format=json&prop=images`
    const imagesRes = await fetch(imagesUrl, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    if (!imagesRes.ok) return null

    const imagesJson = await imagesRes.json()
    const images: string[] = imagesJson?.parse?.images ?? []
    if (images.length === 0) return null

    // Paso 2: buscar splash art (case-insensitive)
    const splashFile = images.find((f) => /splash\s*art/i.test(f))
      ?? images.find((f) => /card|profile|preview/i.test(f))
      ?? null

    if (!splashFile) return null

    // Paso 3: resolver URL directa
    const fileUrl = `https://${host}/api.php?action=query&titles=File:${encodeURIComponent(splashFile)}&format=json&prop=imageinfo&iiprop=url`
    const fileRes = await fetch(fileUrl, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    if (!fileRes.ok) return null

    const fileJson = await fileRes.json()
    const pages = fileJson?.query?.pages ?? {}
    const page = Object.values(pages)[0] as { imageinfo?: { url: string }[] } | undefined
    const url = page?.imageinfo?.[0]?.url

    if (!url) return null

    // Reescalar a alta resolución
    return url
      .replace(/\/scale-to-width-down\/\d+/, '/scale-to-width-down/960')
      .replace(/\/\d+px-/, '/960px-')
  } catch {
    return null
  }
}

export interface SplashArtOptions {
  /** Skip Prydwen (útil si sabemos que es pre-release) */
  skipPrydwen?: boolean
}

/**
 * Punto de entrada único: busca splash art por todas las fuentes.
 *
 * Orden: Fandom primero (tiene pre-release), luego Prydwen (solo post-release).
 */
export async function fetchSplashArt(
  characterName: string,
  host: string,
  options: SplashArtOptions = {}
): Promise<string | null> {
  // 1. Fandom — tiene splash art de personajes pre-release y post-release
  const fandomUrl = await fandomSplashArt(characterName, host)
  if (fandomUrl) return fandomUrl

  // 2. Prydwen — solo para personajes ya lanzados
  if (!options.skipPrydwen) {
    const prydwenUrl = prydwenSplashUrl(characterName)
    if (prydwenUrl) {
      try {
        const head = await fetch(prydwenUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) })
        if (head.ok) return prydwenUrl
      } catch {
        // Silencioso
      }
    }
  }

  return null
}
