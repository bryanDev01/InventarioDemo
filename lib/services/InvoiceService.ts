import { AppError, getErrorMessage } from '@/lib/errors'
import { MESSAGES } from '@/lib/messages'
import { requireRole } from '@/lib/auth'
import { INVOICE_STATUSES, PAYMENT_METHODS, ROLES } from '@/lib/constants'
import type { InvoiceStatus, PaymentMethod, RoleName } from '@/lib/constants'
import { parseRateToCents } from '@/lib/money'
import { AuditRow, InvoiceQuery, InvoiceRow } from '@/lib/queries/invoices'
import { WarehouseQuery } from '@/lib/queries/warehouses'
import { assertWarehouseAccess } from '@/lib/services/PosService'
import { isValidCi, isValidClientName, isValidPlate, normalizePlate, parseQuantity } from '@/lib/validators'
import type { AuthUser } from '@/types/user'
import type {
  CreateInvoiceLinePayload,
  CreateInvoicePayload,
  InvoiceAuditRecord,
  InvoiceListFilters,
  InvoiceListResult,
  InvoiceRecord,
  UpdateInvoicePayload,
} from '@/types/invoice'

const POS_ROLES: readonly RoleName[] = [ROLES.ADMIN, ROLES.INVOICER]
const MAX_NAME_LENGTH = 120
const MAX_LINES = 200
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const REFERENCE_PATTERN = /^POS_[0-9]+_[0-9]{3}$/

const normalizeText = (value: string): string => value.trim().replace(/\s+/g, ' ')

const assertRequestId = (value: unknown): string => {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) throw new AppError(MESSAGES.invoices.invalidRequest, 400)
  return value
}

const assertPaymentMethod = (value: unknown): PaymentMethod => {
  if (value !== PAYMENT_METHODS.CASH && value !== PAYMENT_METHODS.TRANSFER) {
    throw new AppError(MESSAGES.invoices.invalidPayment, 400)
  }
  return value
}

const assertClientName = (value: unknown): string => {
  const name = typeof value === 'string' ? normalizeText(value) : ''
  if (!isValidClientName(name)) throw new AppError(MESSAGES.invoices.invalidClientName, 400)
  return name
}

const assertClientCi = (value: unknown): string => {
  const ci = typeof value === 'string' ? value.trim() : ''
  if (!isValidCi(ci)) throw new AppError(MESSAGES.invoices.invalidClientCi, 400)
  return ci
}

const assertOptionalTransporter = (name: unknown, ci: unknown, plate: unknown): { name: string; ci: string; plate: string } => {
  const transporterName = typeof name === 'string' ? normalizeText(name) : ''
  const transporterCi = typeof ci === 'string' ? ci.trim() : ''
  const vehiclePlate = typeof plate === 'string' ? normalizePlate(plate) : ''
  if (transporterName.length > MAX_NAME_LENGTH) throw new AppError(MESSAGES.invoices.invalidTransporterName, 400)
  if (transporterCi !== '' && !isValidCi(transporterCi)) throw new AppError(MESSAGES.invoices.invalidTransporterCi, 400)
  if (vehiclePlate !== '' && !isValidPlate(vehiclePlate)) throw new AppError(MESSAGES.invoices.invalidPlate, 400)
  return { name: transporterName, ci: transporterCi, plate: vehiclePlate }
}

const assertLines = (value: unknown, allowZero = false): { code: string; quantity: number }[] => {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_LINES) {
    throw new AppError(MESSAGES.invoices.invalidLines, 400)
  }
  return (value as CreateInvoiceLinePayload[]).map((line) => {
    const code = typeof line?.code === 'string' ? line.code.trim().toUpperCase() : ''
    const quantity = typeof line?.quantity === 'string' ? parseQuantity(line.quantity) : null
    if (code === '') throw new AppError(MESSAGES.invoices.invalidLines, 400)
    if (quantity === null) {
      if (allowZero && line.quantity === '0') throw new AppError(MESSAGES.invoices.zeroQuantity, 400)
      throw new AppError(MESSAGES.invoices.invalidLines, 400)
    }
    return { code, quantity }
  })
}

const mapProcessError = (error: unknown): never => {
  const message = getErrorMessage(error)
  const [, code = ''] = message.split(':')
  if (message.includes('WAREHOUSE_NOT_FOUND')) throw new AppError(MESSAGES.invoices.warehouseNotFound, 404)
  if (message.includes('STOCK_INSUFFICIENT')) throw new AppError(MESSAGES.invoices.stockInsufficient(code), 409)
  if (message.includes('PRODUCT_UNAVAILABLE')) throw new AppError(MESSAGES.invoices.productUnavailable(code), 409)
  if (message.includes('DUPLICATE_LINE')) throw new AppError(MESSAGES.invoices.duplicateLine(code), 400)
  if (message.includes('REFERENCE_GENERATION_FAILED')) throw new AppError(MESSAGES.invoices.processFailed, 500)
  throw error
}

const mapChangeError = (error: unknown): never => {
  const message = getErrorMessage(error)
  const [, code = ''] = message.split(':')
  if (message.includes('INVOICE_NOT_FOUND')) throw new AppError(MESSAGES.invoices.notFound, 404)
  if (message.includes('INVALID_LINES')) throw new AppError(MESSAGES.invoices.linesMismatch, 400)
  if (message.includes('STOCK_INSUFFICIENT')) throw new AppError(MESSAGES.invoices.stockInsufficient(code), 409)
  if (message.includes('PRODUCT_UNAVAILABLE')) throw new AppError(MESSAGES.invoices.productUnavailable(code), 409)
  throw error
}

const mapPurgeError = (error: unknown): never => {
  const message = getErrorMessage(error)
  if (message.includes('INVOICE_NOT_FOUND')) throw new AppError(MESSAGES.invoices.notFound, 404)
  if (message.includes('INVOICE_NOT_DELETED')) throw new AppError(MESSAGES.invoices.purgeNotDeleted, 409)
  throw error
}

const toRecord = (row: InvoiceRow): InvoiceRecord => {
  const hasTransporter = row.transporter_name !== null || row.transporter_ci !== null || row.vehicle_plate !== null
  return {
    id: row.id,
    reference: row.reference,
    createdAt: row.created_at,
    modifiedAt: row.modified_at,
    deletedAt: row.deleted_at,
    status: row.status as InvoiceStatus,
    createdById: row.created_by,
    warehouseId: row.warehouse_id,
    warehouseName: row.warehouse_name,
    sellerUsername: row.created_by_username,
    rateCents: Math.round(Number(row.rate) * 100),
    client: { name: row.client_name, ci: row.client_ci },
    transporter: hasTransporter
      ? { name: row.transporter_name, ci: row.transporter_ci, plate: row.vehicle_plate }
      : null,
    paymentMethod: row.payment_method as PaymentMethod,
    totalCupCents: Math.round(Number(row.total_cup) * 100),
    totalUsdCents: Math.round(Number(row.total_usd) * 100),
    lines: row.invoice_lines
      .slice()
      .sort((a, b) => a.line_number - b.line_number)
      .map((line) => ({
        code: line.product_code,
        name: line.product_name,
        basePriceUsdCents: Math.round(Number(line.base_price_usd) * 100),
        unitPriceCupCents: Math.round(Number(line.unit_price_cup) * 100),
        quantity: line.quantity,
        subtotalCupCents: Math.round(Number(line.subtotal_cup) * 100),
        subtotalUsdCents: Math.round(Number(line.subtotal_usd) * 100),
      })),
  }
}

const canManage = (actor: AuthUser, invoice: InvoiceRecord): boolean =>
  actor.role === ROLES.ADMIN || invoice.createdById === actor.id

const assertCanView = (actor: AuthUser, invoice: InvoiceRecord): void => {
  if (!canManage(actor, invoice)) throw new AppError(MESSAGES.auth.forbidden, 403)
}

const loadReference = async (reference: unknown): Promise<InvoiceRecord> => {
  if (typeof reference !== 'string' || !REFERENCE_PATTERN.test(reference)) throw new AppError(MESSAGES.invoices.notFound, 404)
  const row = await InvoiceQuery.findByReference(reference)
  if (!row) throw new AppError(MESSAGES.invoices.notFound, 404)
  return toRecord(row)
}

const parseDate = (value: string | undefined): string | undefined => {
  if (value === undefined || value === '') return undefined
  if (!DATE_PATTERN.test(value)) throw new AppError(MESSAGES.invoices.invalidFilters, 400)
  return value
}

const parseListFilters = (raw: Record<string, string | undefined>, actor: AuthUser): InvoiceListFilters => {
  const page = Math.max(1, Number.parseInt(raw.page ?? '1', 10) || 1)
  const from = parseDate(raw.from)
  const to = parseDate(raw.to)
  if (from && to && to < from) throw new AppError(MESSAGES.invoices.invalidFilters, 400)
  const status = raw.status && Object.values(INVOICE_STATUSES).includes(raw.status as InvoiceStatus) ? raw.status : undefined
  const paymentMethod = raw.paymentMethod === PAYMENT_METHODS.CASH || raw.paymentMethod === PAYMENT_METHODS.TRANSFER ? raw.paymentMethod : undefined
  const warehouseId = raw.warehouseId && (actor.role === ROLES.ADMIN || actor.warehouses.some((w) => w.id === raw.warehouseId))
    ? raw.warehouseId
    : undefined
  return {
    from,
    to,
    warehouseId,
    client: raw.client,
    reference: raw.reference,
    seller: actor.role === ROLES.ADMIN ? raw.seller : undefined,
    paymentMethod,
    status,
    page,
  }
}

export class InvoiceService {
  static async create(actor: AuthUser, payload: CreateInvoicePayload): Promise<InvoiceRecord> {
    await requireRole(POS_ROLES)

    const requestId = assertRequestId(payload.requestId)
    if (typeof payload.warehouseId !== 'string') throw new AppError(MESSAGES.invoices.invalidWarehouse, 400)
    assertWarehouseAccess(actor, payload.warehouseId)
    const warehouse = await WarehouseQuery.findById(payload.warehouseId)
    if (!warehouse || warehouse.is_archived) throw new AppError(MESSAGES.invoices.warehouseNotFound, 404)

    const rateCents = typeof payload.rate === 'string' ? parseRateToCents(payload.rate) : null
    if (rateCents === null) throw new AppError(MESSAGES.invoices.invalidRate, 400)

    const clientName = assertClientName(payload.clientName)
    const clientCi = assertClientCi(payload.clientCi)
    const transporter = assertOptionalTransporter(payload.transporterName, payload.transporterCi, payload.vehiclePlate)
    const paymentMethod = assertPaymentMethod(payload.paymentMethod)
    const lines = assertLines(payload.lines)

    let invoiceId: string
    try {
      invoiceId = await InvoiceQuery.processSale({
        requestId,
        warehouseId: payload.warehouseId,
        userId: actor.id,
        username: actor.username,
        rate: rateCents / 100,
        clientName,
        clientCi,
        transporterName: transporter.name,
        transporterCi: transporter.ci,
        vehiclePlate: transporter.plate,
        paymentMethod,
        lines,
      })
    } catch (error) {
      return mapProcessError(error)
    }

    const row = await InvoiceQuery.findById(invoiceId)
    if (!row) throw new AppError(MESSAGES.invoices.processFailed, 500)
    return toRecord(row)
  }

  static async list(actor: AuthUser, raw: Record<string, string | undefined>): Promise<InvoiceListResult> {
    await requireRole(POS_ROLES)
    const filters = parseListFilters(raw, actor)
    const deletedOnly = raw.view === 'deleted' || filters.status === INVOICE_STATUSES.DELETED
    const { rows, hasNext } = await InvoiceQuery.list({
      ...filters,
      status: deletedOnly ? INVOICE_STATUSES.DELETED : filters.status,
      excludeDeleted: !deletedOnly,
      createdBy: actor.role === ROLES.ADMIN ? null : actor.id,
    })
    return {
      page: filters.page,
      hasNext,
      items: rows.map((row) => ({
        reference: row.reference,
        createdAt: row.created_at,
        warehouseName: row.warehouse_name,
        sellerUsername: row.created_by_username,
        clientName: row.client_name,
        clientCi: row.client_ci,
        itemsCount: row.invoice_lines.length,
        totalCupCents: Math.round(Number(row.total_cup) * 100),
        totalUsdCents: Math.round(Number(row.total_usd) * 100),
        paymentMethod: row.payment_method as PaymentMethod,
        status: row.status as InvoiceStatus,
      })),
    }
  }

  static async get(actor: AuthUser, reference: unknown): Promise<{ invoice: InvoiceRecord; audits: InvoiceAuditRecord[]; canManage: boolean }> {
    await requireRole(POS_ROLES)
    const invoice = await loadReference(reference)
    assertCanView(actor, invoice)
    const audits = await InvoiceQuery.listAudits(invoice.id)
    return {
      invoice,
      audits: audits.map((audit: AuditRow) => ({
        action: audit.action,
        username: audit.username,
        detail: audit.detail,
        createdAt: audit.created_at,
      })),
      canManage: canManage(actor, invoice) && invoice.status !== INVOICE_STATUSES.DELETED,
    }
  }

  static async update(actor: AuthUser, reference: unknown, payload: UpdateInvoicePayload): Promise<InvoiceRecord> {
    await requireRole(POS_ROLES)
    const invoice = await loadReference(reference)
    assertCanView(actor, invoice)
    if (invoice.status === INVOICE_STATUSES.DELETED) throw new AppError(MESSAGES.invoices.deletedReadOnly, 409)

    const lines = assertLines(payload.lines, true)
    const clientName = assertClientName(payload.clientName)
    const clientCi = assertClientCi(payload.clientCi)
    const transporter = assertOptionalTransporter(payload.transporterName, payload.transporterCi, payload.vehiclePlate)
    const paymentMethod = assertPaymentMethod(payload.paymentMethod)

    try {
      await InvoiceQuery.updateInvoice({
        invoiceId: invoice.id,
        userId: actor.id,
        username: actor.username,
        lines,
        clientName,
        clientCi,
        transporterName: transporter.name,
        transporterCi: transporter.ci,
        vehiclePlate: transporter.plate,
        paymentMethod,
      })
    } catch (error) {
      return mapChangeError(error)
    }

    return loadReference(invoice.reference)
  }

  static async remove(actor: AuthUser, reference: unknown): Promise<void> {
    await requireRole(POS_ROLES)
    const invoice = await loadReference(reference)
    assertCanView(actor, invoice)
    if (invoice.status === INVOICE_STATUSES.DELETED) throw new AppError(MESSAGES.invoices.alreadyDeleted, 409)

    try {
      await InvoiceQuery.deleteInvoice({ invoiceId: invoice.id, userId: actor.id, username: actor.username })
    } catch (error) {
      return mapChangeError(error)
    }
  }

  static async purge(actor: AuthUser, reference: unknown): Promise<void> {
    await requireRole([ROLES.ADMIN])
    const invoice = await loadReference(reference)
    if (invoice.status !== INVOICE_STATUSES.DELETED) throw new AppError(MESSAGES.invoices.purgeNotDeleted, 409)

    try {
      await InvoiceQuery.purgeInvoice(invoice.id)
    } catch (error) {
      return mapPurgeError(error)
    }
  }
}
