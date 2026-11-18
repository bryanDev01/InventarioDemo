'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactElement } from 'react'
import { MESSAGES } from '@/lib/messages'
import { ROLES } from '@/lib/constants'
import type { RoleName } from '@/lib/constants'

interface NavigationProps {
  role: RoleName
}

interface NavItem {
  href: string
  label: string
}

const ITEMS_BY_ROLE: Record<RoleName, NavItem[]> = {
  [ROLES.ADMIN]: [
    { href: '/home', label: MESSAGES.ui.nav.home },
    { href: '/users', label: MESSAGES.ui.nav.users },
    { href: '/inventory', label: MESSAGES.ui.nav.inventory },
    { href: '/warehouses', label: MESSAGES.ui.nav.warehouses },
    { href: '/warehouses/movements', label: MESSAGES.ui.nav.movements },
    { href: '/pos', label: MESSAGES.ui.nav.pos },
    { href: '/invoices', label: MESSAGES.ui.nav.invoices },
  ],
  [ROLES.INVOICER]: [
    { href: '/home', label: MESSAGES.ui.nav.home },
    { href: '/pos', label: MESSAGES.ui.nav.pos },
    { href: '/invoices', label: MESSAGES.ui.nav.invoices },
    { href: '/reports', label: MESSAGES.ui.nav.reports },
  ],
  [ROLES.SELLER]: [],
}

const isActive = (pathname: string, href: string): boolean => {
  if (pathname === href) return true
  if (href === '/inventory') {
    return pathname === '/inventory' || (pathname.startsWith('/warehouses/') && pathname !== '/warehouses/movements')
  }
  return false
}

export default function Navigation({ role }: NavigationProps): ReactElement {
  const pathname = usePathname()
  const items = ITEMS_BY_ROLE[role]

  return (
    <nav aria-label="Navegación principal" className="overflow-x-auto border-b border-gold/40 bg-black">
      <ul className="mx-auto flex w-max min-w-full max-w-6xl gap-4 px-3 sm:gap-6 sm:px-6 md:gap-4 lg:gap-6">
        {items.map((item) => {
          const active = isActive(pathname, item.href)
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`block whitespace-nowrap border-b-2 py-3 text-sm font-medium ${active ? 'border-gold text-gold' : 'border-transparent text-ivory/70 hover:text-ivory'}`}
              >
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
