/**
 * De dónde sale la lista de eventos de cada juego.
 *
 * Comparativa de fuentes hecha en vivo el 2026-08-21:
 *
 *   Tablón oficial HoYoverse — fechas exactas, texto del estudio, banner.
 *     Solo HSR y ZZZ. Mezcla eventos con notas de parche, y su ventana es la
 *     del anuncio, no la del evento. Sirve para enriquecer, no para listar.
 *   API de Kuro (Wuthering Waves) — el endpoint del launcher solo publica
 *     descargas; el foro (KuroBBS) responde 102 sin credenciales.
 *   Hypergryph (Endfield) — la web de noticias es una SPA sin API pública.
 *   Cargo / Semantic MediaWiki — ninguna de las cuatro wikis lo tiene
 *     instalado, así que no hay consulta estructurada.
 *
 * Conclusión: las wikis son la única fuente que cubre los cuatro juegos, y
 * sus páginas de eventos ya vienen en tablas o tarjetas. Se parsean tal cual,
 * sin LLM de por medio.
 */

export type ParserKind = 'fandom-table' | 'endfield-cards' | 'hsr-warps'

export interface GameSource {
  gameSlug: string
  parser: ParserKind
  /** URL de la API MediaWiki de la página con la lista de eventos. */
  sourceUrl: string
  /**
   * Secciones a pedir por separado (solo endfield-cards: su lista no es una
   * tabla, así que se piden las secciones Ongoing y Upcoming sueltas).
   *
   * Por NOMBRE, no por índice: el índice se resuelve en cada pasada contra
   * `prop=sections`. Cablearlo hacía que insertar una sección en la wiki
   * desviara el scraper a otro contenido sin dar error.
   */
  sections?: string[]
  /** Página legible por humanos, para guardar como referencia en la fila. */
  humanUrl: string
  /** Host de la wiki, para ir a buscar la descripción a la página del evento. */
  wikiHost: string
  /**
   * Fuente adicional para banners de gacha (solo HSR). La wiki de Fandom
   * lista los eventos en una tabla y los banners de gacha en otra distinta
   * (Warp/List). Sin esto, los banners de rates-up no aparecen en /banners.
   */
  bannersUrl?: string
}

export const SOURCES: Record<string, GameSource> = {
  'honkai-star-rail': {
    gameSlug: 'honkai-star-rail',
    parser: 'fandom-table',
    // OJO: aquí la página es "Events" en plural. En las otras dos wikis de
    // Fandom es singular. No unificar sin comprobarlo contra la API.
    sourceUrl:
      'https://honkai-star-rail.fandom.com/api.php?action=parse&page=Events&format=json',
    humanUrl: 'https://honkai-star-rail.fandom.com/wiki/Events',
    wikiHost: 'honkai-star-rail.fandom.com',
    // Banners de gacha (rates-up de personajes). Están en Warp/List, no en Events.
    bannersUrl:
      'https://honkai-star-rail.fandom.com/api.php?action=parse&page=Warp/List&format=json',
  },

  'zenless-zone-zero': {
    gameSlug: 'zenless-zone-zero',
    parser: 'fandom-table',
    sourceUrl:
      'https://zenless-zone-zero.fandom.com/api.php?action=parse&page=Event&format=json',
    humanUrl: 'https://zenless-zone-zero.fandom.com/wiki/Event',
    wikiHost: 'zenless-zone-zero.fandom.com',
  },

  'wuthering-waves': {
    gameSlug: 'wuthering-waves',
    parser: 'fandom-table',
    sourceUrl:
      'https://wutheringwaves.fandom.com/api.php?action=parse&page=Event&format=json',
    humanUrl: 'https://wutheringwaves.fandom.com/wiki/Event',
    wikiHost: 'wutheringwaves.fandom.com',
  },

  'arknights-endfield': {
    gameSlug: 'arknights-endfield',
    parser: 'endfield-cards',
    // endfield.wiki.gg, NO arknights.wiki.gg: ese segundo es el Arknights
    // original de tower defense, un juego distinto.
    sourceUrl: 'https://endfield.wiki.gg/api.php?action=parse&page=Event&format=json',
    sections: ['Ongoing', 'Upcoming'],
    humanUrl: 'https://endfield.wiki.gg/wiki/Event',
    wikiHost: 'endfield.wiki.gg',
  },
}
