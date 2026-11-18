import { Suspense } from 'react'
import type { ReactElement } from 'react'
import InventoryContent from '@/components/Inventory/InventoryContent'

interface WarehouseInventoryPageProps {
  params: Promise<{ id: string }>
}

export default async function WarehouseInventoryPage({ params }: WarehouseInventoryPageProps): Promise<ReactElement> {
  const { id } = await params
  return (
    <Suspense fallback={<div className="min-h-[40vh] rounded-lg bg-ivory/20" />}>
      <InventoryContent warehouseId={id} />
    </Suspense>
  )
}
