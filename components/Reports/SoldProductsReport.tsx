import Link from 'next/link'
import type { ReactElement } from 'react'
import { requireUser } from '@/lib/auth'
import { ROLES } from '@/lib/constants'
import { formatCents } from '@/lib/money'
import { MESSAGES } from '@/lib/messages'
import { ReportService } from '@/lib/services/ReportService'
import { WarehouseService } from '@/lib/services/WarehouseService'
import type { AuthUser } from '@/types/user'
import type { WarehouseOption } from '@/types/warehouse'

interface SoldProductsReportProps {
  filters: { from?: string; to?: string; warehouseId?: string }
  actor?: AuthUser
}

const buildQuery = (filters: SoldProductsReportProps['filters']): string => {
  const query = new URLSearchParams()
  if (filters.from) query.set('from', filters.from)
  if (filters.to) query.set('to', filters.to)
  if (filters.warehouseId) query.set('warehouseId', filters.warehouseId)
  return query.toString()
}

export default async function SoldProductsReport({ filters, actor }: SoldProductsReportProps): Promise<ReactElement> {
  const user = actor ?? (await requireUser())
  const report = await ReportService.build(user, filters)

  const warehouses: WarehouseOption[] = user.role === ROLES.ADMIN
    ? await WarehouseService.listOptions()
    : user.warehouses

  const query = buildQuery(filters)
  const exportBase = `/api/reports/sold-products/export?${query}`
  const inputClass = 'rounded-md border border-ivory-dark bg-ivory px-3 py-2 text-sm text-black focus:border-gold focus:outline-none'

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-gold">{MESSAGES.reports.title}</h1>

      <form method="get" className="grid gap-3 rounded-lg bg-ivory p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-black">{MESSAGES.reports.from}
          <input type="date" name="from" defaultValue={filters.from ?? ''} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-black">{MESSAGES.reports.to}
          <input type="date" name="to" defaultValue={filters.to ?? ''} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-black">{MESSAGES.reports.warehouse}
          <select name="warehouseId" defaultValue={filters.warehouseId ?? ''} className={inputClass}>
            <option value="">{MESSAGES.reports.allWarehouses}</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button type="submit" className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:bg-gold-hover">{MESSAGES.reports.filter}</button>
          <Link href="/home" className="rounded-md border border-black px-4 py-2 text-sm text-black hover:bg-ivory-dark">{MESSAGES.reports.today}</Link>
        </div>
      </form>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gold bg-black p-5">
          <p className="text-sm text-ivory/80">{MESSAGES.reports.cards.incomeCup}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-gold">{formatCents(report.incomeCupCents)}</p>
        </div>
        <div className="rounded-lg border border-gold bg-black p-5">
          <p className="text-sm text-ivory/80">{MESSAGES.reports.cards.incomeUsd}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-gold">{formatCents(report.invoicesUsdCents)}</p>
        </div>
        <div className="rounded-lg border border-gold bg-black p-5">
          <p className="text-sm text-ivory/80">{MESSAGES.reports.cards.products}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-gold">{report.productsSold}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ivory/80">
          {MESSAGES.reports.period}: {report.period.label} · {MESSAGES.reports.warehouse}: {report.warehouse.label}
        </p>
        <div className="flex gap-2">
          {report.rows.length > 0 ? (
            <>
              <a href={`${exportBase}${query ? '&' : ''}format=pdf`} className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:bg-gold-hover">
                {MESSAGES.reports.exportPdf}
              </a>
              <a href={`${exportBase}${query ? '&' : ''}format=word`} className="rounded-md border border-gold px-4 py-2 text-sm text-gold hover:bg-gold hover:text-black">
                {MESSAGES.reports.exportWord}
              </a>
            </>
          ) : (
            <span className="text-sm text-ivory/60">{MESSAGES.reports.emptyHint}</span>
          )}
        </div>
      </div>

      {report.rows.length === 0 ? (
        <div className="rounded-lg bg-ivory p-10 text-center text-black">{MESSAGES.reports.empty}</div>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-ivory">
          <table className="min-w-full text-left text-sm text-black">
            <thead className="border-b border-ivory-dark bg-ivory-dark">
              <tr>
                <th className="px-3 py-2 font-medium">{MESSAGES.reports.columns.code}</th>
                <th className="px-3 py-2 font-medium">{MESSAGES.reports.columns.name}</th>
                <th className="px-3 py-2 text-right font-medium">{MESSAGES.reports.columns.quantity}</th>
                <th className="px-3 py-2 text-right font-medium">{MESSAGES.reports.columns.columnsCUP}</th>
                <th className="px-3 py-2 text-right font-medium">{MESSAGES.reports.columns.columnsUSD}</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={row.code} className="border-b border-ivory-dark last:border-0">
                  <td className="px-3 py-2 font-mono">{row.code}</td>
                  <td className="px-3 py-2">{row.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.quantity}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCents(row.totalCupCents)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCents(row.totalUsdCents)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-ivory-dark bg-ivory-dark">
              <tr>
                <td className="px-3 py-2 font-semibold" colSpan={2}>{MESSAGES.reports.totalProducts}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">{report.productsSold}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatCents(report.incomeCupCents)}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatCents(report.incomeUsdCents)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {report.roundingDifference && (
        <p className="text-xs text-amber-200">{MESSAGES.reports.roundingNote}</p>
      )}
    </div>
  )
}
