import { Suspense } from 'react'
import type { ReactElement } from 'react'
import LoginContent from '@/components/Auth/LoginContent'

export const instant = false

export default function LoginPage(): ReactElement {
  return (
    <main className="flex flex-1 items-center justify-center bg-black p-4 sm:p-6">
      <Suspense fallback={<div className="h-64 w-full max-w-sm rounded-lg bg-ivory" />}>
        <LoginContent />
      </Suspense>
    </main>
  )
}
