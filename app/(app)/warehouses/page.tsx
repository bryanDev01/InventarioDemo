import { Suspense } from 'react'
import type { ReactElement } from 'react'
import WarehousesContent from '@/components/Warehouses/WarehousesContent'

export default function WarehousesPage(): ReactElement {
  return (
    <Suspense fallback={<div className="min-h-[40vh] rounded-lg bg-ivory/20" />}>
      <WarehousesContent />
    </Suspense>
  )
}
