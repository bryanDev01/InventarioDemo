import { AppError } from '@/lib/errors'
import { MESSAGES } from '@/lib/messages'
import { requireRole } from '@/lib/auth'
import { APP_NAME, ROLES } from '@/lib/constants'
import type { RoleName } from '@/lib/constants'
import { formatDate, formatDateTime, getTodayDate } from '@/lib/dates'
import { ReportQuery } from '@/lib/queries/reports'
import { WarehouseQuery } from '@/lib/queries/warehouses'
import type { AuthUser } from '@/types/user'

const REPORT_ROLES: readonly RoleName[] = [ROLES.ADMIN, ROLES.INVOICER]
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export interface ReportRow {
  code: string
  name: string
  quantity: number
  totalCupCents: number
  totalUsdCents: number
}

export interface SoldProductsReport {
  title: string
  generatedAt: string
  generatedAtText: string
  period: { from: string; to: string; label: string }
  warehouse: { id: string | null; label: string }
  rows: ReportRow[]
  productsSold: number
  incomeCupCents: number
  incomeUsdCents: number
  invoicesUsdCents: number
  invoicesCount: number
  roundingDifference: boolean
}

export interface ReportFilters {
  from?: string
  to?: string
  warehouseId?: string
}

const parseDate = (value: string | undefined, fallback: string): string => {
  if (value === undefined || value === '') return fallback
  if (!DATE_PATTERN.test(value)) throw new AppError(MESSAGES.reports.invalidFilters, 400)
  return value
}

const buildPeriodLabel = (from: string, to: string): string => {
  const today = getTodayDate()
  const prefix = from === today && to === today ? 'HOY ' : ''
  return `${prefix}[${from} a ${to}]`
}

export class ReportService {
  static async build(actor: AuthUser, filters: ReportFilters): Promise<SoldProductsReport> {
    await requireRole(REPORT_ROLES)

    const today = getTodayDate()
    const from = parseDate(filters.from, today)
    const to = parseDate(filters.to, from)
    if (to < from) throw new AppError(MESSAGES.reports.invalidFilters, 400)

    const allowedWarehouses = actor.role === ROLES.ADMIN
      ? (await WarehouseQuery.listAll()).map((warehouse) => ({ id: warehouse.id, name: warehouse.name }))
      : actor.warehouses

    const warehouseId = filters.warehouseId && allowedWarehouses.some((warehouse) => warehouse.id === filters.warehouseId)
      ? filters.warehouseId
      : null
    if (filters.warehouseId && warehouseId === null) throw new AppError(MESSAGES.auth.forbidden, 403)

    const invoices = await ReportQuery.listInvoices({
      from,
      to,
      warehouseId,
      createdBy: actor.role === ROLES.ADMIN ? null : actor.id,
    })

    const rowsByCode = new Map<string, ReportRow>()
    let incomeCupCents = 0
    let incomeUsdCents = 0
    let invoicesUsdCents = 0
    let productsSold = 0

    for (const invoice of invoices) {
      invoicesUsdCents += Math.round(Number(invoice.total_usd) * 100)
      for (const line of invoice.invoice_lines) {
        const subtotalCupCents = Math.round(Number(line.subtotal_cup) * 100)
        const subtotalUsdCents = Math.round(Number(line.subtotal_usd) * 100)
        incomeCupCents += subtotalCupCents
        incomeUsdCents += subtotalUsdCents
        productsSold += line.quantity
        const existing = rowsByCode.get(line.product_code)
        if (existing) {
          existing.quantity += line.quantity
          existing.totalCupCents += subtotalCupCents
          existing.totalUsdCents += subtotalUsdCents
        } else {
          rowsByCode.set(line.product_code, {
            code: line.product_code,
            name: line.product_name,
            quantity: line.quantity,
            totalCupCents: subtotalCupCents,
            totalUsdCents: subtotalUsdCents,
          })
        }
      }
    }

    const rows = Array.from(rowsByCode.values()).sort(
      (a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name, 'es')
    )

    const warehouseLabel = warehouseId === null
      ? MESSAGES.reports.allWarehouses
      : allowedWarehouses.find((warehouse) => warehouse.id === warehouseId)?.name ?? warehouseId

    return {
      title: `${APP_NAME} - ${MESSAGES.reports.title}`,
      generatedAt: new Date().toISOString(),
      generatedAtText: formatDateTime(new Date()),
      period: { from, to, label: buildPeriodLabel(from, to) },
      warehouse: { id: warehouseId, label: warehouseLabel },
      rows,
      productsSold,
      incomeCupCents,
      incomeUsdCents,
      invoicesUsdCents,
      invoicesCount: invoices.length,
      roundingDifference: Math.abs(incomeUsdCents - invoicesUsdCents) > 0,
    }
  }

  static assertNotEmpty(report: SoldProductsReport): void {
    if (report.rows.length === 0) throw new AppError(MESSAGES.reports.empty, 400)
  }

  static periodText(report: SoldProductsReport): string {
    return `${MESSAGES.reports.period}: ${report.period.label}`
  }

  static generatedText(report: SoldProductsReport): string {
    return `${MESSAGES.reports.generated}: ${report.generatedAtText}`
  }

  static warehouseText(report: SoldProductsReport): string {
    return `${MESSAGES.reports.warehouse}: ${report.warehouse.label}`
  }

  static todayText(): string {
    return formatDate(new Date())
  }
}
