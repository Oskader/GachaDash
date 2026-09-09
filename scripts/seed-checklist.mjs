/**
 * Siembra `checklist_items` con la rutina de endgame de cada juego.
 *
 * A diferencia del resto de scripts de esta carpeta, esto NO es una migración
 * de un solo uso: es contenido, es idempotente y se puede volver a ejecutar.
 * La clave natural es (game_id, title); reejecutarlo actualiza categoría y
 * orden sin duplicar filas ni tocar el progreso de nadie, porque
 * `user_checklist_progress` apunta al id del item, que no cambia.
 *
 *   node scripts/seed-checklist.mjs           # aplica
 *   node scripts/seed-checklist.mjs --dry-run # solo enseña lo que haría
 *
 * Los nombres de los modos están verificados contra las wikis de cada juego
 * (2026-08-21). El texto es el de la rutina, no el del modo: lo que importa
 * es qué tienes que acordarte de hacer antes del reset.
 */

import { readFileSync } from 'node:fs'

const DRY_RUN = process.argv.includes('--dry-run')

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}

const headers = {
  apikey: `${SERVICE_KEY}`,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
}

/**
 * category usa el enum de Postgres: qué estás farmeando, no cada cuánto.
 *   other       rutina diaria/semanal
 *   artifact    reliquias / ecos / discos
 *   weapon      armas, conos de luz, motores W
 *   character   subir al personaje en curso
 *   achievement retos de endgame puntuables
 *   story       historia
 * is_permanent: true = parte fija del juego; false = depende de la versión.
 */
const CHECKLISTS = {
  // [titulo en espanol, categoria, titulo en ingles].
  // Los nombres de sistema del juego estan verificados contra la wiki inglesa
  // de cada titulo: 'Caverna de Corrosion' es 'Cavern of Corrosion', no una
  // traduccion literal. En Endfield se comprobaron ademas contra
  // endfield.wiki.gg: Sanity, Operational Manual, AIC, Protocol Pass, Operator.

  'honkai-star-rail': [
    ['Memoria del Caos: cerrar las 12 plantas', 'achievement', 'Memory of Chaos: clear all 12 floors'],
    ['Ficción Pura del ciclo', 'achievement', 'Pure Fiction for the cycle'],
    ['Sombra Apocalíptica del ciclo', 'achievement', 'Apocalyptic Shadow for the cycle'],
    ['Arbitraje de Anomalías del ciclo', 'achievement', 'Anomaly Arbitration for the cycle'],
  ],

  'zenless-zone-zero': [
    ['Gastar la Batería antes de que llegue al tope', 'other', 'Spend Battery Charge before it caps'],
    ['Completar las comisiones diarias de Inter-Knot', 'other', 'Complete the Inter-Knot daily commissions'],
    ['Recoger los ingresos del videoclub', 'other', 'Collect the video store income'],
    ['Ridu Weekly: tareas de la semana', 'other', 'Ridu Weekly: tasks for the week'],
    ['Zona Hueca (Hollow Zero) de la semana', 'other', 'Hollow Zero for the week'],
    ['Farmear discos de impulso', 'artifact', 'Farm Drive Discs'],
    ['Farmear material de motores W', 'weapon', 'Farm W-Engine materials'],
    ['Ascender al Agente en curso', 'character', 'Ascend the Agent you are working on'],
    ['Defensa de Shiyu: cerrar el piso crítico', 'achievement', 'Shiyu Defense: clear the Critical Node'],
    ['Asalto Letal del ciclo', 'achievement', 'Deadly Assault for the cycle'],
  ],

  'wuthering-waves': [
    ['Gastar el Waveplate antes de que se llene', 'other', 'Spend Waveplate before it caps'],
    ['Completar las actividades diarias', 'other', 'Complete the daily activities'],
    ['Reclamar el Pioneer Podcast', 'other', 'Claim the Pioneer Podcast'],
    ['Desafío Semanal: jefes de la semana', 'other', 'Weekly Challenge: bosses for the week'],
    ['Entrenamiento de Simulación de la semana', 'other', 'Simulation Training for the week'],
    ['Farmear Ecos en los Campos Tácitos', 'artifact', 'Farm Echoes in Tacet Fields'],
    ['Forgery Challenge: material de armas', 'weapon', 'Forgery Challenge: weapon materials'],
    ['Ascender al Resonador en curso', 'character', 'Ascend the Resonator you are working on'],
    ['Torre de Adversidad: cerrar los tres sectores', 'achievement', 'Tower of Adversity: clear all three sectors'],
    ['Yermos Gimientes del ciclo', 'achievement', 'Whimpering Wastes for the cycle'],
  ],

  'arknights-endfield': [
    ['Gastar la Cordura antes de que llegue al tope', 'other', 'Spend Sanity before it caps'],
    ['Completar el Manual de Operaciones del día', 'other', 'Complete the daily Operational Manual'],
    ['Recoger la producción de la base', 'other', 'Collect the AIC production'],
    ['Reclamar el Centro de Adquisiciones', 'other', 'Claim the Acquisition Center'],
    ['Canjear lo pendiente en el Arsenal', 'other', 'Redeem what is pending in the Arsenal'],
    ['Avanzar el Protocol Pass', 'other', 'Advance the Protocol Pass'],
    ['Subir al operador en el que estés trabajando', 'character', 'Level up the Operator you are working on'],
    ['Avanzar la historia principal', 'story', 'Advance the main story'],
  ],
}

async function rest(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers })
  const text = await res.text()
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : null
}

async function main() {
  const games = await rest('games?select=id,slug,name')
  const bySlug = Object.fromEntries(games.map((g) => [g.slug, g]))

  let inserted = 0
  let updated = 0

  for (const [slug, items] of Object.entries(CHECKLISTS)) {
    const game = bySlug[slug]
    if (!game) {
      console.warn(`  ! ${slug}: no existe en la tabla games, se salta`)
      continue
    }

    const existing = await rest(
      `checklist_items?select=id,title&game_id=eq.${game.id}`
    )
    const byTitle = new Map(existing.map((r) => [r.title, r.id]))

    console.log(`\n${game.name} — ${items.length} items`)

    for (const [index, [title, category, titleEn]] of items.entries()) {
      const row = {
        game_id: game.id,
        // `title` sigue escribiendose porque la columna vieja aun existe: si
        // se dejara de rellenar, las filas nuevas quedarian con NULL ahi.
        title,
        title_es: title,
        title_en: titleEn,
        category,
        sort_order: index,
        is_permanent: true,
        description: null,
      }

      const existingId = byTitle.get(title)
      const verb = existingId ? 'actualiza' : 'inserta '
      console.log(`  ${verb} [${category.padEnd(11)}] ${title}`)
      console.log(`  ${' '.repeat(9)} ${' '.repeat(11)}  EN: ${titleEn}`)

      if (DRY_RUN) continue

      if (existingId) {
        // `title` NO se actualiza: es la clave natural con la que se ha
        // encontrado esta fila. Las columnas de idioma sí, que es lo que
        // trae este script cuando cambia una traduccion.
        await rest(`checklist_items?id=eq.${existingId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            category,
            sort_order: index,
            title_es: title,
            title_en: titleEn,
          }),
        })
        updated++
      } else {
        await rest('checklist_items', {
          method: 'POST',
          body: JSON.stringify(row),
        })
        inserted++
      }
    }
  }

  console.log(
    DRY_RUN
      ? '\n(dry-run: no se ha escrito nada)'
      : `\nHecho: ${inserted} insertados, ${updated} actualizados.`
  )
}

main().catch((err) => {
  console.error('Falló el seed:', err.message)
  process.exit(1)
})
