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
  gameName: string
}) {
  const supabase = await createClient()

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
