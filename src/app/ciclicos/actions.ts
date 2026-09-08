'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export interface ToggleResult {
  ok: boolean
  error?: string
}

/**
 * Marca o desmarca un item del checklist de endgame de /ciclicos.
 *
 * Esto era una escritura desde el cliente cuyo resultado se descartaba, y
 * cuyo estado optimista revertía al terminar la transición porque nada
 * revalidaba los datos del servidor. Como Server Action, `revalidatePath`
 * refresca la fuente de verdad y el valor optimista converge en vez de
 * volver atrás.
 */
export async function toggleChecklistItem(
  itemId: string,
  completed: boolean
): Promise<ToggleResult> {
  const supabase = await createClient()

  // getUser() valida el JWT contra el servidor de auth; getSession() solo
  // decodifica la cookie y se fía de ella.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { ok: false, error: 'Inicia sesión para guardar tu progreso' }
  }

  const { error } = await supabase.from('user_checklist_progress').upsert(
    {
      user_id: user.id,
      checklist_item_id: itemId,
      completed,
      completed_at: completed ? new Date().toISOString() : null,
    },
    { onConflict: 'user_id,checklist_item_id' }
  )

  if (error) {
    console.error('[checklist] upsert failed:', error.message)
    return { ok: false, error: 'No se pudo guardar el cambio' }
  }

  revalidatePath('/ciclicos')

  return { ok: true }
}
