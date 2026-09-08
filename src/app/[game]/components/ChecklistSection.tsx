import Link from 'next/link'
import { ChecklistClient } from './ChecklistClient'
import { createClient } from '@/lib/supabase/server'
import type { Dictionary, Locale } from '@/lib/i18n'
import type { Database } from '@/lib/supabase/types'

type ChecklistItemRow = Database['public']['Tables']['checklist_items']['Row']

export async function ChecklistSection({
  items,
  gameSlug,
  accentColor,
  locale,
  labels,
  gameName,
  showSignIn = true,
}: {
  items: ChecklistItemRow[]
  gameSlug: string
  accentColor: string
  locale: Locale
  labels: Dictionary['game']
  /** Pinta el nombre del juego en la cabecera del checklist. */
  gameName?: string
  /**
   * En la vista agregada el aviso de sesión se pinta UNA vez al final de la
   * página, no uno por juego — cuatro paneles idénticos son ruido.
   */
  showSignIn?: boolean
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

  if (items.length === 0) {
    return (
      <section>
        <h2 className="eyebrow mb-4">{labels.checklistHeading}</h2>
        <p className="text-sm text-dim">{labels.checklistEmpty}</p>
      </section>
    )
  }

  return (
    <div>
      <ChecklistClient
        items={items}
        completedIds={completedIds}
        gameSlug={gameSlug}
        accentColor={accentColor}
        isSignedIn={Boolean(user)}
        locale={locale}
        labels={labels}
        gameName={gameName}
      />

      {showSignIn && !user && (
        <p className="mt-4 border border-line bg-panel px-4 py-3 text-sm text-dim">
          <Link
            href={`/login?next=/${gameSlug}`}
            className="font-medium text-foreground underline underline-offset-4 hover:text-[var(--urgency-low)]"
          >
            {labels.signInLink}
          </Link>{' '}
          {labels.signInRest}
        </p>
      )}
    </div>
  )
}
