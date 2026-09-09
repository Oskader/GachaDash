/**
 * Añade start_date y end_date a checklist_items.
 *
 * Los endgames cíclicos (Memoria del Caos, Ficción Pura, Sombra Apocalíptica)
 * tienen ventanas de 21 días. Estas columnas permiten mostrar un countdown
 * en la sección de Endgame de /ciclicos.
 *
 * Se aplica via Management API (no Supabase CLI migration).
 */

import { readFileSync } from 'node:fs'

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

const PROJECT_REF = 'vubovpxyuxnrjytmrshw' // Extract from URL: https://vubovpxyuxnrjytmrshw.supabase.co

async function main() {
  // Verificar si las columnas ya existen
  const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/checklist_items?select=start_date&limit=0`, {
    headers: {
      apikey: `${SERVICE_KEY}`,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
  })
  
  if (checkRes.ok) {
    console.log('Las columnas ya existen, no hay nada que hacer.')
    return
  }

  // Aplicar DDL via Management API
  const ddl = `
    ALTER TABLE checklist_items 
    ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ;
  `

  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: ddl }),
  })

  const text = await res.text()
  if (!res.ok && !text.includes('already exists')) {
    console.error('Error aplicando DDL:', text)
    process.exit(1)
  }

  console.log('Columnas start_date y end_date añadidas a checklist_items.')
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
