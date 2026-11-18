import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { ReactElement } from 'react'
import AccessDenied from '@/components/Common/AccessDenied'
import InventoryTable from '@/components/Inventory/InventoryTable'
import { requireUser } from '@/lib/auth'
import { ROLES } from '@/lib/constants'
import { MESSAGES } from '@/lib/messages'
import { ProductService } from '@/lib/services/ProductService'
import { WarehouseService } from '@/lib/services/WarehouseService'

interface InventoryContentProps {
  warehouseId?: string
  openImport?: boolean
}

export default async function InventoryContent({ warehouseId, openImport = false }: InventoryContentProps): Promise<ReactElement> {
  const user = await requireUser()
  if (user.role !== ROLES.ADMIN) return <AccessDenied />

  const warehouses = await WarehouseService.listOptions()
  if (warehouses.length === 0) {
    return (
      <div className="rounded-lg border border-ivory-dark bg-ivory p-8 text-center">
        <p className="text-black/75">{MESSAGES.ui.inventory.noWarehouses}</p>
        <Link href="/warehouses" className="mt-4 inline-block rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:bg-gold-hover">
          {MESSAGES.ui.inventory.manageWarehouses}
        </Link>
      </div>
    )
  }

  const selectedId = warehouseId ?? warehouses[0].id
  if (!warehouses.some((warehouse) => warehouse.id === selectedId)) notFound()

  const [warehouse, products] = await Promise.all([
    WarehouseService.get(selectedId),
    ProductService.listInventory(selectedId),
  ])

  return (
    <InventoryTable
      warehouse={{ id: warehouse.id, name: warehouse.name }}
      products={products}
      warehouses={warehouses}
      openImport={openImport}
    />
  )
}
