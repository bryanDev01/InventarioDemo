import { getDayRangeUtc } from '@/lib/dates'
import { createAdminClient } from '@/lib/supabase/admin'

export interface ReportLineRow {
  product_code: string
  product_name: string
  base_price_usd: number
  quantity: number
  subtotal_cup: number
  subtotal_usd: number
}

export interface ReportInvoiceRow {
  id: string
  reference: string
  created_at: string
  created_by: string | null
  warehouse_id: string
  warehouse_name: string
  rate: number
  total_cup: number
  total_usd: number
  invoice_lines: ReportLineRow[]
}

const SELECT = 'id, reference, created_at, created_by, warehouse_id, warehouse_name, rate, total_cup, total_usd, invoice_lines(product_code, product_name, base_price_usd, quantity, subtotal_cup, subtotal_usd)'

export const ReportQuery = {
  async listInvoices(params: {
    from: string
    to: string
    warehouseId: string | null
    createdBy: string | null
  }): Promise<ReportInvoiceRow[]> {
    const admin = createAdminClient()
    const range = getDayRangeUtc(params.from, params.to)
    let query = admin
      .from('invoices')
      .select(SELECT)
      .neq('status', 'deleted')
      .gte('created_at', range.start.toISOString())
      .lt('created_at', range.end.toISOString())
    if (params.warehouseId) query = query.eq('warehouse_id', params.warehouseId)
    if (params.createdBy) query = query.eq('created_by', params.createdBy)
    const { data, error } = await query.order('created_at')
    if (error) throw error
    return data as unknown as ReportInvoiceRow[]
  },
}
