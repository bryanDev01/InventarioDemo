import type { InvoiceStatus, PaymentMethod } from '@/lib/constants'

export interface InvoiceLineRecord {
  code: string
  name: string
  basePriceUsdCents: number
  unitPriceCupCents: number
  quantity: number
  subtotalCupCents: number
  subtotalUsdCents: number
}

export interface InvoiceRecord {
  id: string
  reference: string
  createdAt: string
  modifiedAt: string | null
  deletedAt: string | null
  status: InvoiceStatus
  createdById: string | null
  warehouseId: string
  warehouseName: string
  sellerUsername: string
  rateCents: number
  client: { name: string; ci: string }
  transporter: { name: string | null; ci: string | null; plate: string | null } | null
  paymentMethod: PaymentMethod
  totalCupCents: number
  totalUsdCents: number
  lines: InvoiceLineRecord[]
}

export interface InvoiceAuditRecord {
  action: string
  username: string
  detail: string
  createdAt: string
}

export interface InvoiceListItem {
  reference: string
  createdAt: string
  warehouseName: string
  sellerUsername: string
  clientName: string
  clientCi: string
  itemsCount: number
  totalCupCents: number
  totalUsdCents: number
  paymentMethod: PaymentMethod
  status: InvoiceStatus
}

export interface InvoiceListFilters {
  from?: string
  to?: string
  warehouseId?: string
  client?: string
  reference?: string
  seller?: string
  paymentMethod?: string
  status?: string
  page: number
}

export interface InvoiceListResult {
  items: InvoiceListItem[]
  page: number
  hasNext: boolean
}

export interface CreateInvoiceLinePayload {
  code: string
  quantity: string
}

export interface CreateInvoicePayload {
  requestId: string
  warehouseId: string
  rate: string
  clientName: string
  clientCi: string
  transporterName?: string
  transporterCi?: string
  vehiclePlate?: string
  paymentMethod: PaymentMethod | ''
  lines: CreateInvoiceLinePayload[]
}

export interface UpdateInvoicePayload {
  lines: CreateInvoiceLinePayload[]
  clientName: string
  clientCi: string
  transporterName?: string
  transporterCi?: string
  vehiclePlate?: string
  paymentMethod: PaymentMethod | ''
}
