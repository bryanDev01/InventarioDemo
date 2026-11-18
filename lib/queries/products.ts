import { createAdminClient } from '@/lib/supabase/admin'
import type { InventoryImportRpcRow } from '@/types/inventoryImport'

export interface InventoryRow {
  product_code: string
  base_price_usd: number
  stock: number
  products: { name: string } | null
}

export interface ProductRow {
  code: string
  name: string
}

export interface ImportInventoryRow {
  warehouse_id: string
  product_code: string
  base_price_usd: number
  stock: number
  deleted_at: string | null
}

const IMPORT_LOOKUP_BATCH_SIZE = 500

const splitIntoBatches = <T>(items: T[], size: number): T[][] => {
  const batches: T[][] = []
  for (let index = 0; index < items.length; index += size) batches.push(items.slice(index, index + size))
  return batches
}

export const ProductQuery = {
  async listInventory(warehouseId: string): Promise<InventoryRow[]> {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('warehouse_products')
      .select('product_code, base_price_usd, stock, products(name)')
      .eq('warehouse_id', warehouseId)
      .is('deleted_at', null)
    if (error) throw error
    return data as unknown as InventoryRow[]
  },

  async findInventoryItem(warehouseId: string, code: string): Promise<InventoryRow | null> {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('warehouse_products')
      .select('product_code, base_price_usd, stock, products(name)')
      .eq('warehouse_id', warehouseId)
      .eq('product_code', code)
      .is('deleted_at', null)
      .maybeSingle()
    if (error) throw error
    return data as unknown as InventoryRow | null
  },

  async findProduct(code: string): Promise<ProductRow | null> {
    const admin = createAdminClient()
    const { data, error } = await admin.from('products').select('code, name').eq('code', code).maybeSingle()
    if (error) throw error
    return data as ProductRow | null
  },

  async findImportState(warehouseId: string, codes: string[]): Promise<{ products: ProductRow[]; inventory: ImportInventoryRow[] }> {
    if (codes.length === 0) return { products: [], inventory: [] }
    const admin = createAdminClient()
    const batches = splitIntoBatches(codes, IMPORT_LOOKUP_BATCH_SIZE)
    const results = await Promise.all(batches.map(async (batch) => {
      const [products, inventory] = await Promise.all([
        admin.from('products').select('code, name').in('code', batch),
        admin.from('warehouse_products')
          .select('warehouse_id, product_code, base_price_usd, stock, deleted_at')
          .eq('warehouse_id', warehouseId)
          .in('product_code', batch),
      ])
      if (products.error) throw products.error
      if (inventory.error) throw inventory.error
      return {
        products: products.data as ProductRow[],
        inventory: inventory.data as ImportInventoryRow[],
      }
    }))
    return {
      products: results.flatMap((result) => result.products),
      inventory: results.flatMap((result) => result.inventory),
    }
  },

  async renameProduct(code: string, name: string): Promise<void> {
    const admin = createAdminClient()
    const { error } = await admin.from('products').update({ name }).eq('code', code)
    if (error) throw error
  },

  async updatePrice(warehouseId: string, code: string, basePriceCents: number): Promise<void> {
    const admin = createAdminClient()
    const { error } = await admin
      .from('warehouse_products')
      .update({ base_price_usd: basePriceCents / 100 })
      .eq('warehouse_id', warehouseId)
      .eq('product_code', code)
    if (error) throw error
  },

  async softDeleteFromInventory(warehouseId: string, code: string): Promise<void> {
    const admin = createAdminClient()
    const { error } = await admin
      .from('warehouse_products')
      .update({ deleted_at: new Date().toISOString() })
      .eq('warehouse_id', warehouseId)
      .eq('product_code', code)
    if (error) throw error
  },

  async registerProduct(params: {
    warehouseId: string
    code: string | null
    name: string
    basePrice: number
    stock: number
    userId: string
  }): Promise<string> {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('register_product', {
      p_warehouse_id: params.warehouseId,
      p_code: params.code ?? undefined,
      p_name: params.name,
      p_base_price: params.basePrice,
      p_stock: params.stock,
      p_user_id: params.userId,
    })
    if (error) throw error
    return data as string
  },

  async setWarehouseStock(params: {
    warehouseId: string
    code: string
    newStock: number
    userId: string
    observation: string | null
  }): Promise<void> {
    const admin = createAdminClient()
    const { error } = await admin.rpc('set_warehouse_stock', {
      p_warehouse_id: params.warehouseId,
      p_code: params.code,
      p_new_stock: params.newStock,
      p_user_id: params.userId,
      p_observation: params.observation ?? undefined,
    })
    if (error) throw error
  },

  async importInventory(warehouseId: string, userId: string, rows: InventoryImportRpcRow[]): Promise<string[]> {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('import_inventory', {
      p_warehouse_id: warehouseId,
      p_user_id: userId,
      p_rows: rows,
    })
    if (error) throw error
    return data as string[]
  },
}
