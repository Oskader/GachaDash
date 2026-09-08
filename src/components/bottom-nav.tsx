'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarClock, LayoutGrid, RefreshCw, Settings, User } from 'lucide-react'

/** Rutas donde la barra estorba en vez de ayudar. */
const HIDDEN_ON = ['/login', '/register', '/']

interface Props {
  /**
   * Los textos llegan del servidor. Este componente es de cliente —necesita
   * `usePathname` para saber qué pestaña está activa— y leer la cookie aquí
   * obligaría a un segundo render en el navegador.
   */
  labels: {
    hoy: string
    juegos: string
    semanales: string
    cuenta: string
    ajustes: string
    aria: string
  }
}

export function BottomNav({ labels }: Props) {
  const pathname = usePathname()

  if (HIDDEN_ON.includes(pathname)) return null

  const items = [
    { href: '/hoy', label: labels.hoy, icon: CalendarClock },
    { href: '/juegos', label: labels.juegos, icon: LayoutGrid },
    { href: '/semanales', label: labels.semanales, icon: RefreshCw },
    { href: '/cuenta', label: labels.cuenta, icon: User },
    { href: '/ajustes', label: labels.ajustes, icon: Settings },
  ]

  return (
    <nav
      aria-label={labels.aria}
      // Fondo sólido, no translúcido: el contenido no debe leerse por
      // detrás de la navegación, y el sistema no usa blur en ningún sitio.
      className="sticky bottom-0 z-40 border-t border-line bg-background"
      // Respeta la barra de gestos en iOS dentro de la PWA.
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-lg">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex flex-col items-center gap-1 py-2.5 text-[10px] uppercase tracking-[0.12em] transition-colors ${
                  active
                    ? 'text-foreground'
                    : 'text-dim hover:text-foreground'
                }`}
              >
                {/* La pestaña activa se marca con una regla arriba, no con
                    un pill de fondo: mismo lenguaje de hairlines. */}
                <span
                  aria-hidden="true"
                  className={`absolute -top-px left-1/2 h-px w-10 -translate-x-1/2 transition-colors ${
                    active ? 'bg-foreground' : 'bg-transparent'
                  }`}
                />
                <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
