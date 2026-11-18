import { Suspense } from 'react'
import type { ReactElement } from 'react'
import PosContent from '@/components/Pos/PosContent'

export default function PosPage(): ReactElement {
  return (
    <Suspense fallback={<div className="min-h-[40vh] rounded-lg bg-ivory/20" />}>
      <PosContent />
    </Suspense>
  )
}
