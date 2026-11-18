import type { MovementType } from '@/lib/constants'

export interface StockMovementRecord {
  id: string
  warehouseId: string
  warehouseName: string
  productCode: string
  productName: string
  type: MovementType
  quantity: number
  stockAfter: number
  observation: string | null
  username: string
  createdAt: string
}

export interface StockMovementFilters {
  warehouseId?: string
  product?: string
  type?: MovementType
  from?: string
  to?: string
  page: number
}

export interface StockMovementListResult {
  items: StockMovementRecord[]
  page: number
  hasNext: boolean
}

export type ManualMovementType = 'entry' | 'exit' | 'transfer'

export interface CreateStockMovementPayload {
  type: ManualMovementType
  warehouseId: string
  destinationWarehouseId?: string
  productCode: string
  quantity: string
  observation?: string | null
}
