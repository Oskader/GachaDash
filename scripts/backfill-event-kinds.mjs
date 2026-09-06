/**
 * Backfill de la columna `kind` de la tabla `events`.
 *
 * Reclasifica las filas existentes con la MISMA heurística que usará el
 * scraper (src/lib/scraper/classify.ts). Los scripts de esta carpeta son
 * .mjs y no pueden importar TypeScript, así que las reglas van duplicadas
 * aquí: mantenerlas letra a letra. El verificador anti-drift ya existe —
 * cuando el runner clasifique, `npm run scrape -- --dry-run` imprime el kind
 * por fila y tiene que coincidir con el resumen de este script.
 *
 * Idempotente: sin --force solo toca filas con kind NULL. Reejecutarlo tras
 * aplicarlo no cambia nada.
 *
 *   node scripts/backfill-event-kinds.mjs           # dry-run: solo imprime
 *   node scripts/backfill-event-kinds.mjs --apply   # pide confirmación y escribe
 *   node scripts/backfill-event-kinds.mjs --force   # reclasifica lo ya marcado
 *
 * Requiere la DDL de docs/migrations/2026-09-04-add-event-kind.md para
 * escribir. En dry-run funciona sin ella: asume que todo está pendiente.
 */

import { readFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'

const APPLY = process.argv.includes('--apply')
const FORCE = process.argv.includes('--force')

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
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
}

// ── Réplica de src/lib/scraper/classify.ts ──────────────────────────────

const GAME_RULES = {
  default: { bannerMaxDays: 25, longDays: 35 },
  'arknights-endfield': { bannerMaxDays: 30, longDays: 45 },
}

const TITLE_OVERRIDES = {}

const LOGIN_EVENT_RE = /\b(?:fund|anniversary|login|check.?in|gift|endgame)\b/i
const NON_BANNER_RE = /\b(?:defense|training|fund|anniversary|endgame|login|gift)\b/i

function durationDays(start_date, end_date) {
  return (Date.parse(end_date) - Date.parse(start_date)) / 86_400_000
}

/** R0 overrides · R1 login-kw · R2 larga · R3 rutina · R4 corta · R5 resto. */
function classifyEvent({ title, start_date, end_date }, gameSlug) {
  const override = TITLE_OVERRIDES[title]
  if (override) return override

  const { bannerMaxDays, longDays } = GAME_RULES[gameSlug] ?? GAME_RULES.default
  const days = durationDays(start_date, end_date)

  if (LOGIN_EVENT_RE.test(title)) return 'login_event'
  if (days > longDays) return 'login_event'
  if (NON_BANNER_RE.test(title)) return 'mission'
  if (!Number.isFinite(days)) return 'other'
  if (days <= bannerMaxDays) return 'banner'
  return 'mission'
}

// ── Script ──────────────────────────────────────────────────────────────

async function fetchEvents(select) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/events?select=${select}&order=id`,
    { headers }
  )
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    // PGRST204: la columna aún no existe — DDL sin aplicar.
    if (body?.code === 'PGRST204' && /kind/i.test(body?.message ?? '')) return null
    throw new Error(`GET /rest/v1/events: ${res.status} ${JSON.stringify(body)}`)
  }
  return body
}

async function patchKind(id, kind) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/events?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify({ kind }),
  })
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
}

const trunc = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

let rows = await fetchEvents('id,title,start_date,end_date,kind,games:games(slug)')

if (rows === null) {
  if (APPLY) {
    console.error(
      'La columna `kind` no existe todavía. Aplica antes la DDL de\n' +
        'docs/migrations/2026-09-04-add-event-kind.md y vuelve a ejecutar.'
    )
    process.exit(1)
  }
  console.warn(
    'AVISO: la columna `kind` aún no existe (DDL sin aplicar).\n' +
      'El dry-run asume que todas las filas están pendientes.\n'
  )
  rows = await fetchEvents('id,title,start_date,end_date,games:games(slug)')
  if (rows === null) process.exit(1)
}

// Candidatas: pendientes, o todas con --force.
const candidates = rows.filter((r) => FORCE || r.kind == null)
const skipped = rows.length - candidates.length

// Tabla agrupada por juego, ordenada por cierre dentro de cada grupo.
const byGame = new Map()
for (const row of candidates) {
  const slug = row.games?.slug ?? '(sin juego)'
  if (!byGame.has(slug)) byGame.set(slug, [])
  byGame.get(slug).push(row)
}

let n = 0
for (const [slug, list] of byGame) {
  console.log(`\n── ${slug} (${list.length})`)
  console.log('   días  kind_asignado   título')
  for (const row of list.sort((a, b) => a.end_date.localeCompare(b.end_date))) {
    row._kind = classifyEvent(row, slug)
    n++
    const days = durationDays(row.start_date, row.end_date)
    const daysLabel = Number.isFinite(days) ? days.toFixed(1).padStart(6) : '     —'
    const changed = row.kind != null && row.kind !== row._kind ? `  (antes: ${row.kind})` : ''
    console.log(`${daysLabel}  ${row._kind.padEnd(14)} ${trunc(row.title, 48)}${changed}`)
  }
}

console.log(
  `\nTotal: ${rows.length} procesadas · ${n} a clasificar · ${skipped} saltadas`
)

if (n === 0) {
  console.log('Nada que hacer: todas las filas ya tienen kind (usa --force para reclasificar).')
  process.exit(0)
}

if (!APPLY) {
  console.log('\nDry-run: no se ha escrito nada. Pasa --apply para escribir.')
  process.exit(0)
}

// Confirmación solo con TTY; en una tubería, --apply manda sin preguntar.
if (stdout.isTTY) {
  const rl = createInterface({ input: stdin, output: stdout })
  const answer = await rl.question(`\n¿Escribir kind en ${n} filas? (s/n) `)
  rl.close()
  if (!/^s(i|í)?$/i.test(answer.trim())) {
    console.log('Cancelado — nada escrito.')
    process.exit(0)
  }
}

let updated = 0
const failed = []
for (const [slug, list] of byGame) {
  for (const row of list) {
    try {
      await patchKind(row.id, row._kind)
      updated++
    } catch (err) {
      failed.push(row.title)
      console.error(`  ✗ ${slug} · ${row.title}: ${err.message}`)
    }
  }
}

console.log(
  `\nHecho: ${rows.length} procesadas · ${updated} actualizadas · ` +
    `${skipped} saltadas · ${failed.length} reventadas`
)
if (failed.length > 0) process.exit(1)
