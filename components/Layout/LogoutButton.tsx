import type { ReactElement } from 'react'
import { MESSAGES } from '@/lib/messages'

export default function LogoutButton(): ReactElement {
  return (
    <form action="/api/auth/logout" method="post">
      <button
        type="submit"
        className="min-h-11 rounded-md border border-gold px-3 py-2 text-sm text-gold hover:bg-gold hover:text-black"
      >
        {MESSAGES.ui.nav.logout}
      </button>
    </form>
  )
}
