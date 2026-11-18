import { redirect } from 'next/navigation'
import type { ReactElement, ReactNode } from 'react'
import Header from '@/components/Layout/Header'
import Navigation from '@/components/Layout/Navigation'
import { getCurrentUser } from '@/lib/auth'

interface AuthenticatedShellProps {
  children: ReactNode
}

export default async function AuthenticatedShell({ children }: AuthenticatedShellProps): Promise<ReactElement> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-black">
      <Header user={user} />
      <Navigation role={user.role} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-3 py-4 sm:p-6">{children}</main>
    </div>
  )
}
