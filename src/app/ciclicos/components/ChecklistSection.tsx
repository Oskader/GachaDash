import { ChecklistClient } from './ChecklistClient'
import { createClient } from '@/lib/supabase/server'
import type { Dictionary, Locale } from '@/lib/i18n'
import type { Database } from '@/lib/supabase/types'

type ChecklistItemRow = Database['public']['Tables']['checklist_items']['Row']

export async function ChecklistSection({
  items,
  gameName,
  accentColor,
  locale,
  labels,
}: {
  items: ChecklistItemRow[]
  accentColor: string
  locale: Locale
  labels: Dictionary['game']
  /** Nombra al juego con su stripe en la cabecera: aquí conviven varios. */
  gameName: string
}) {
  const supabase = await createClient()

  // getUser() valida la firma del JWT; getSession() se limita a decodificar
  // la cookie y darla por buena.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let completedIds: string[] = []

  if (user && items.length > 0) {
    const { data } = await supabase
      .from('user_checklist_progress')
      .select('checklist_item_id, completed')
      .eq('user_id', user.id)
      .in(
        'checklist_item_id',
        items.map((i) => i.id)
      )

    completedIds = (data ?? [])
      .filter((row) => row.completed)
      .map((row) => row.checklist_item_id)
  }

  // El aviso de sesión no va aquí: la página pinta UNO solo al final para
  // todos los juegos, no un panel idéntico por juego.
  return (
    <ChecklistClient
      items={items}
      completedIds={completedIds}
      accentColor={accentColor}
      isSignedIn={Boolean(user)}
      locale={locale}
      labels={labels}
      gameName={gameName}
    />
  )
}
