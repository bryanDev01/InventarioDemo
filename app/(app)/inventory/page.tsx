import { Suspense } from 'react'
import type { ReactElement } from 'react'
import InventoryContent from '@/components/Inventory/InventoryContent'

interface InventoryPageProps {
  searchParams: Promise<{ warehouse?: string; import?: string }>
}

export default async function InventoryPage({ searchParams }: InventoryPageProps): Promise<ReactElement> {
  const { warehouse, import: importFile } = await searchParams
  return (
    <Suspense fallback={<div className="min-h-[40vh] rounded-lg bg-ivory/20" />}>
      <InventoryContent warehouseId={warehouse} openImport={importFile === '1'} />
    </Suspense>
  )
}
