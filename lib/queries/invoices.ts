import { getDayRangeUtc } from '@/lib/dates'
import { INVOICE_STATUSES } from '@/lib/constants'
import { createAdminClient } from '@/lib/supabase/admin'
import type { InvoiceListFilters } from '@/types/invoice'

export interface InvoiceRow {
  id: string
  reference: string
  created_at: string
  created_by: string | null
  warehouse_id: string
  warehouse_name: string
  created_by_username: string
  rate: number
  client_name: string
  client_ci: string
  transporter_name: string | null
  transporter_ci: string | null
  vehicle_plate: string | null
  payment_method: string
  total_cup: number
  total_usd: number
  status: string
  modified_at: string | null
  deleted_at: string | null
  invoice_lines: InvoiceLineRow[]
}

export interface InvoiceLineRow {
  product_code: string
  product_name: string
  base_price_usd: number
  unit_price_cup: number
  quantity: number
  subtotal_cup: number
  subtotal_usd: number
  line_number: number
}

export interface InvoiceListRow extends Omit<InvoiceRow, 'invoice_lines' | 'transporter_name' | 'transporter_ci' | 'vehicle_plate' | 'modified_at' | 'deleted_at'> {
  invoice_lines: { product_code: string }[]
}

export interface AuditRow {
  action: string
  username: string
  detail: string
  created_at: string
}

const DETAIL_SELECT = 'id, reference, created_at, created_by, warehouse_id, warehouse_name, created_by_username, rate, client_name, client_ci, transporter_name, transporter_ci, vehicle_plate, payment_method, total_cup, total_usd, status, modified_at, deleted_at, invoice_lines(product_code, product_name, base_price_usd, unit_price_cup, quantity, subtotal_cup, subtotal_usd, line_number)'

const LIST_SELECT = 'id, reference, created_at, created_by, warehouse_id, warehouse_name, created_by_username, rate, client_name, client_ci, payment_method, total_cup, total_usd, status, invoice_lines(product_code)'

export const PAGE_SIZE = 20

const sanitizeSearch = (value: string): string => value.replace(/[^\p{L}\p{N} .-]/gu, '').trim()

export const InvoiceQuery = {
  async processSale(params: {
    requestId: string
    warehouseId: string
    userId: string
    username: string
    rate: number
    clientName: string
    clientCi: string
    transporterName: string
    transporterCi: string
    vehiclePlate: string
    paymentMethod: string
    lines: { code: string; quantity: number }[]
  }): Promise<string> {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('process_invoice', {
      p_request_id: params.requestId,
      p_warehouse_id: params.warehouseId,
      p_user_id: params.userId,
      p_username: params.username,
      p_rate: params.rate,
      p_client_name: params.clientName,
      p_client_ci: params.clientCi,
      p_transporter_name: params.transporterName,
      p_transporter_ci: params.transporterCi,
      p_vehicle_plate: params.vehiclePlate,
      p_payment_method: params.paymentMethod,
      p_lines: params.lines,
    })
    if (error) throw error
    return data as string
  },

  async findById(id: string): Promise<InvoiceRow | null> {
    const admin = createAdminClient()
    const { data, error } = await admin.from('invoices').select(DETAIL_SELECT).eq('id', id).maybeSingle()
    if (error) throw error
    return data as unknown as InvoiceRow | null
  },

  async findByReference(reference: string): Promise<InvoiceRow | null> {
    const admin = createAdminClient()
    const { data, error } = await admin.from('invoices').select(DETAIL_SELECT).eq('reference', reference).maybeSingle()
    if (error) throw error
    return data as unknown as InvoiceRow | null
  },

  async listAudits(invoiceId: string): Promise<AuditRow[]> {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('invoice_audits')
      .select('action, username, detail, created_at')
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data as AuditRow[]
  },

  async list(filters: InvoiceListFilters & { createdBy: string | null; excludeDeleted: boolean }): Promise<{ rows: InvoiceListRow[]; hasNext: boolean }> {
    const admin = createAdminClient()
    let query = admin.from('invoices').select(LIST_SELECT)

    if (filters.excludeDeleted) query = query.neq('status', INVOICE_STATUSES.DELETED)
    if (filters.from) {
      const range = getDayRangeUtc(filters.from, filters.to ?? filters.from)
      query = query.gte('created_at', range.start.toISOString()).lt('created_at', range.end.toISOString())
    }
    if (filters.warehouseId) query = query.eq('warehouse_id', filters.warehouseId)
    if (filters.createdBy) query = query.eq('created_by', filters.createdBy)
    if (filters.paymentMethod) query = query.eq('payment_method', filters.paymentMethod)
    if (filters.status) query = query.eq('status', filters.status)

    const client = sanitizeSearch(filters.client ?? '')
    if (client !== '') {
      query = query.or(`client_name.ilike.%${client}%,client_ci.eq.${client}`)
    }
    const reference = sanitizeSearch(filters.reference ?? '')
    if (reference !== '') query = query.ilike('reference', `%${reference}%`)
    const seller = sanitizeSearch(filters.seller ?? '')
    if (seller !== '') query = query.ilike('created_by_username', `%${seller}%`)

    const from = (filters.page - 1) * PAGE_SIZE
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE)
    if (error) throw error
    const rows = data as unknown as InvoiceListRow[]
    return { rows: rows.slice(0, PAGE_SIZE), hasNext: rows.length > PAGE_SIZE }
  },

  async updateInvoice(params: {
    invoiceId: string
    userId: string
    username: string
    lines: { code: string; quantity: number }[]
    clientName: string
    clientCi: string
    transporterName: string
    transporterCi: string
    vehiclePlate: string
    paymentMethod: string
  }): Promise<void> {
    const admin = createAdminClient()
    const { error } = await admin.rpc('update_invoice', {
      p_invoice_id: params.invoiceId,
      p_user_id: params.userId,
      p_username: params.username,
      p_lines: params.lines,
      p_client_name: params.clientName,
      p_client_ci: params.clientCi,
      p_transporter_name: params.transporterName,
      p_transporter_ci: params.transporterCi,
      p_vehicle_plate: params.vehiclePlate,
      p_payment_method: params.paymentMethod,
    })
    if (error) throw error
  },

  async deleteInvoice(params: { invoiceId: string; userId: string; username: string }): Promise<void> {
    const admin = createAdminClient()
    const { error } = await admin.rpc('delete_invoice', {
      p_invoice_id: params.invoiceId,
      p_user_id: params.userId,
      p_username: params.username,
    })
    if (error) throw error
  },

  async purgeInvoice(invoiceId: string): Promise<void> {
    const admin = createAdminClient()
    const { error } = await admin.rpc('purge_invoice', { p_invoice_id: invoiceId })
    if (error) throw error
  },
}
