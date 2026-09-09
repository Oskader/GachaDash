/**
 * Calcula y actualiza las fechas de los endgames cíclicos de HSR.
 *
 * Memoria del Caos, Ficción Pura y Sombra Apocalíptica renuevan cada 21 días
 * (3 semanas), escalonados 1 semana entre sí.
 *
 * El script calcula las ventanas a partir de un ancla conocido y proyecta
 * N ciclos hacia delante.
 *
 *   node scripts/update-endgame-cycles.mjs --dry-run
 *   node scripts/update-endgame-cycles.mjs
 */

import { readFileSync } from 'node:fs'

const DRY_RUN = process.argv.includes('--dry-run')
const PROJECTS_AHEAD = parseInt(process.argv.find(a => a.startsWith('--projects='))?.split('=')[1] ?? '6')

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

async function rest(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers })
  const text = await res.text()
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : null
}

/**
 * Anclas conocidas: fecha de inicio de cada ciclo.
 * Se actualizan manualmente cuando cambia el schedule del juego.
 */
const ANCHORS = {
  'memory-of-chaos': '2026-08-26T00:00:00Z',
  'pure-fiction': '2026-08-19T00:00:00Z',
  'apocalyptic-shadow': '2026-09-02T00:00:00Z',
}

const CYCLE_DAYS = 21

function calculateCycles(anchorStr, numProjects) {
  const anchor = new Date(anchorStr)
  const now = new Date()
  const cycles = []
  const msPerCycle = CYCLE_DAYS * 24 * 60 * 60 * 1000
  
  const diffMs = now.getTime() - anchor.getTime()
  const cyclesSinceAnchor = Math.floor(diffMs / msPerCycle)
  
  for (let i = -1; i < numProjects; i++) {
    const cycleNum = cyclesSinceAnchor + i
    const startMs = anchor.getTime() + cycleNum * msPerCycle
    const endMs = startMs + msPerCycle - 1
    
    cycles.push({
      start_date: new Date(startMs).toISOString(),
      end_date: new Date(endMs).toISOString(),
      cycle: cycleNum,
    })
  }
  
  return cycles
}

async function main() {
  console.log(`\n=== Calculando ciclos de endgame (${PROJECTS_AHEAD} ciclos hacia delante) ===\n`)
  
  const games = await rest('games?select=id,slug,name')
  const hsrGame = games.find(g => g.slug === 'honkai-star-rail')
  if (!hsrGame) {
    console.error('No se encontró honkai-star-rail en la BD')
    process.exit(1)
  }
  
  const items = await rest(`checklist_items?select=id,title&game_id=eq.${hsrGame.id}&category=eq.achievement`)
  
  const titleToSlug = {
    'Memoria del Caos': 'memory-of-chaos',
    'Ficción Pura': 'pure-fiction',
    'Sombra Apocalíptica': 'apocalyptic-shadow',
  }
  
  for (const item of items) {
    const slug = titleToSlug[item.title]
    if (!slug) {
      console.log(`  - ${item.title}: no tiene ancla configurado, se salta`)
      continue
    }
    
    const anchor = ANCHORS[slug]
    if (!anchor) {
      console.log(`  - ${item.title}: sin ancla conocida`)
      continue
    }
    
    const cycles = calculateCycles(anchor, PROJECTS_AHEAD)
    
    const now = Date.now()
    const currentCycle = cycles.find(c => 
      new Date(c.start_date).getTime() <= now && new Date(c.end_date).getTime() >= now
    ) || cycles.find(c => new Date(c.start_date).getTime() > now)
    
    if (!currentCycle) {
      console.log(`  - ${item.title}: no se encontró ciclo actual`)
      continue
    }
    
    const nextIdx = cycles.indexOf(currentCycle) + 1
    const nextCycle = cycles[nextIdx]
    
    console.log(`  ${item.title}:`)
    console.log(`    Ciclo actual: ${currentCycle.start_date.slice(0,10)} → ${currentCycle.end_date.slice(0,10)}`)
    if (nextCycle) {
      console.log(`    Próximo:      ${nextCycle.start_date.slice(0,10)} → ${nextCycle.end_date.slice(0,10)}`)
    }
    
    if (!DRY_RUN) {
      await rest(`checklist_items?id=eq.${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          start_date: currentCycle.start_date,
          end_date: currentCycle.end_date,
        }),
      })
    }
  }
  
  console.log(DRY_RUN ? '\n(dry-run: no se ha escrito nada)' : '\nHecho.')
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
