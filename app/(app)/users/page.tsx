import { Suspense } from 'react'
import type { ReactElement } from 'react'
import UsersContent from '@/components/Users/UsersContent'

export default function UsersPage(): ReactElement {
  return (
    <Suspense fallback={<div className="min-h-[40vh] rounded-lg bg-ivory/20" />}>
      <UsersContent />
    </Suspense>
  )
}
