import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <main className="mx-auto max-w-lg px-4 pb-10">
      <div className="py-6">
        <Skeleton className="mb-3 h-3 w-24 rounded-none" />
        <Skeleton className="h-8 w-52 rounded-none" />
      </div>

      <div className="space-y-9">
        <section>
          <Skeleton className="mb-4 h-3 w-16 rounded-none" />
          <div className="space-y-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2 border-b border-line pb-4">
                <div className="flex gap-3">
                  {/* Reserva la miniatura: sin este hueco, al llegar el
                      contenido real el texto salta a la derecha. Las medidas
                      siguen a `event-row.tsx` — si cambian allí, cambian aquí. */}
                  <Skeleton className="h-[86px] w-[152px] shrink-0 rounded-sm sm:h-[117px] sm:w-[208px]" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex justify-between gap-4">
                      <Skeleton className="h-5 w-2/3 rounded-none" />
                      <Skeleton className="h-4 w-16 rounded-none" />
                    </div>
                  </div>
                </div>
                {/* La descripción cruza la fila entera, igual que en
                    `event-row.tsx`. */}
                <Skeleton className="h-3 w-full rounded-none" />
                {/* La mecha va FUERA del flex: cruza la fila entera, igual que
                    en `event-row.tsx`. */}
                <Skeleton className="h-[3px] w-full rounded-none" />
              </div>
            ))}
          </div>
        </section>

        <section>
          <Skeleton className="mb-4 h-3 w-20 rounded-none" />
          <Skeleton className="mb-5 h-[3px] w-full rounded-none" />
          <div className="space-y-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-5 w-full rounded-none" />
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
