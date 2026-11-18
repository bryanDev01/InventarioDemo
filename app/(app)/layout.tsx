import { Suspense } from 'react'
import type { ReactElement, ReactNode } from 'react'
import AuthenticatedShell from '@/components/Layout/AuthenticatedShell'

// Toda la aplicacion depende de la sesion: la navegacion espera al servidor en vez de prerenderizarse.
export const instant = false

interface AppLayoutProps {
  children: ReactNode
}

export default function AppLayout({ children }: AppLayoutProps): ReactElement {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </Suspense>
  )
}
