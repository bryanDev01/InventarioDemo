import type { WarehouseOption } from '@/types/warehouse'

export interface CatalogProduct {
  code: string
  name: string
  basePriceUsdCents: number
  stock: number
}

export interface PosCatalog {
  warehouses: WarehouseOption[]
  warehouseId: string | null
  products: CatalogProduct[]
}
