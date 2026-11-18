import { getDayRangeUtc } from '@/lib/dates'
import { createAdminClient } from '@/lib/supabase/admin'
import type { StockMovementFilters } from '@/types/stockMovement'

export interface StockMovementRow {
  id: string
  warehouse_id: string
  product_code: string
  movement_type: string
  quantity: number
  stock_after: number
  observation: string | null
  created_at: string
  products: { name: string } | null
  warehouses: { name: string } | null
  profiles: { username: string } | null
}

export const MOVEMENTS_PAGE_SIZE = 20

const SELECT =
  'id, warehouse_id, product_code, movement_type, quantity, stock_after, observation, created_at, products(name), warehouses(name), profiles(username)'

const sanitizeSearch = (value: string): string => value.replace(/[^\p{L}\p{N} .-]/gu, '').trim()

export const StockMovementQuery = {
  async list(filters: StockMovementFilters): Promise<{ rows: StockMovementRow[]; hasNext: boolean }> {
    const admin = createAdminClient()
    let query = admin.from('stock_movements').select(SELECT)

    if (filters.from) {
      const range = getDayRangeUtc(filters.from, filters.to ?? filters.from)
      query = query.gte('created_at', range.start.toISOString()).lt('created_at', range.end.toISOString())
    }
    if (filters.warehouseId) query = query.eq('warehouse_id', filters.warehouseId)
    if (filters.type) query = query.eq('movement_type', filters.type)

    const term = sanitizeSearch(filters.product ?? '')
    if (term !== '') {
      const { data: products, error: productError } = await admin
        .from('products')
        .select('code')
        .or(`code.ilike.%${term}%,name.ilike.%${term}%`)
        .limit(200)
      if (productError) throw productError
      const codes = (products ?? []).map((row) => row.code)
      if (codes.length === 0) return { rows: [], hasNext: false }
      query = query.in('product_code', codes)
    }

    const from = (filters.page - 1) * MOVEMENTS_PAGE_SIZE
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .range(from, from + MOVEMENTS_PAGE_SIZE)
    if (error) throw error
    const rows = data as unknown as StockMovementRow[]
    return { rows: rows.slice(0, MOVEMENTS_PAGE_SIZE), hasNext: rows.length > MOVEMENTS_PAGE_SIZE }
  },

  async registerEntry(params: {
    warehouseId: string
    code: string
    quantity: number
    observation: string | null
    userId: string
  }): Promise<number> {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('register_stock_entry', {
      p_warehouse_id: params.warehouseId,
      p_code: params.code,
      p_quantity: params.quantity,
      p_observation: params.observation ?? '',
      p_user_id: params.userId,
    })
    if (error) throw error
    return data as number
  },

  async registerExit(params: {
    warehouseId: string
    code: string
    quantity: number
    observation: string | null
    userId: string
  }): Promise<number> {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('register_stock_exit', {
      p_warehouse_id: params.warehouseId,
      p_code: params.code,
      p_quantity: params.quantity,
      p_observation: params.observation ?? '',
      p_user_id: params.userId,
    })
    if (error) throw error
    return data as number
  },

  async transfer(params: {
    originId: string
    destinationId: string
    code: string
    quantity: number
    observation: string | null
    userId: string
  }): Promise<string> {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('transfer_stock', {
      p_origin_id: params.originId,
      p_destination_id: params.destinationId,
      p_code: params.code,
      p_quantity: params.quantity,
      p_observation: params.observation ?? '',
      p_user_id: params.userId,
    })
    if (error) throw error
    return data as string
  },
}
