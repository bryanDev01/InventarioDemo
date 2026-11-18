import Image from 'next/image'
import type { ReactElement } from 'react'
import LogoutButton from '@/components/Layout/LogoutButton'
import { APP_NAME, ROLES } from '@/lib/constants'
import { MESSAGES } from '@/lib/messages'
import type { AuthUser } from '@/types/user'

interface HeaderProps {
  user: AuthUser
}

const ROLE_LABELS: Record<AuthUser['role'], string> = {
  [ROLES.ADMIN]: 'Administrador',
  [ROLES.INVOICER]: 'Facturador',
  [ROLES.SELLER]: 'Vendedor',
}

export default function Header({ user }: HeaderProps): ReactElement {
  const warehouses = user.role === ROLES.ADMIN
    ? MESSAGES.ui.header.allWarehouses
    : user.warehouses.length > 0
      ? user.warehouses.map((warehouse) => warehouse.name).join(', ')
      : MESSAGES.ui.header.noWarehouses

  return (
    <header className="bg-black">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-4">
        <div className="flex min-w-0 flex-wrap items-center gap-3 sm:gap-4">
          <Image
            src="/logo.svg"
            alt={APP_NAME}
            width={400}
            height={120}
            priority
            className="h-10 w-auto sm:h-12"
          />
          <span aria-hidden className="hidden h-10 w-px bg-gold/40 sm:block" />
          <span className="min-w-0 break-words text-xs text-ivory/80 sm:text-sm">
            {MESSAGES.ui.header.user}: <strong className="font-medium text-ivory">{user.username}</strong>
            {' · '}
            {MESSAGES.ui.header.role}: {ROLE_LABELS[user.role]}
            {' · '}
            {MESSAGES.ui.header.warehouses}: {warehouses}
          </span>
        </div>
        <div className="self-start sm:self-auto">
          <LogoutButton />
        </div>
      </div>
    </header>
  )
}
