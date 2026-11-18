import type { ReactElement } from 'react'
import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { AppError } from '@/lib/errors'
import { MESSAGES } from '@/lib/messages'
import { InvoiceService } from '@/lib/services/InvoiceService'
import { WarehouseService } from '@/lib/services/WarehouseService'
import { ROLES } from '@/lib/constants'
import { PAYMENT_METHODS } from '@/lib/constants'
import { formatCents } from '@/lib/money'
import { formatDateTime } from '@/lib/dates'
import PermanentDeleteButton from '@/components/Invoices/PermanentDeleteButton'
import type { InvoiceListResult } from '@/types/invoice'
import type { WarehouseOption } from '@/types/warehouse'

interface InvoicesContentProps {
  searchParams: Promise<Record<string, string | undefined>>
}

const H = MESSAGES.invoices.history

const pageHref = (params: Record<string, string | undefined>, page: number): string => {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== 'page') query.set(key, value)
  }
  query.set('page', String(page))
  return `/invoices?${query.toString()}`
}

export default async function InvoicesContent({ searchParams }: InvoicesContentProps): Promise<ReactElement> {
  const params = await searchParams
  const actor = await requireUser()
  const deletedOnly = params.view === 'deleted' || params.status === 'deleted'
  const listHref = deletedOnly ? '/invoices?view=deleted' : '/invoices'

  let result: InvoiceListResult | null = null
  let errorMessage: string | null = null
  try {
    result = await InvoiceService.list(actor, params)
  } catch (error) {
    if (error instanceof AppError) errorMessage = error.message
    else throw error
  }

  const warehouses: WarehouseOption[] = actor.role === ROLES.ADMIN
    ? await WarehouseService.listOptions()
    : actor.warehouses

  const inputClass = 'rounded-md border border-ivory-dark bg-ivory px-3 py-2 text-sm text-black focus:border-gold focus:outline-none'

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-gold">{deletedOnly ? H.deletedTitle : H.title}</h1>

      <nav aria-label={H.title} className="overflow-x-auto rounded-lg border border-ivory-dark bg-black">
        <ul className="flex min-w-full gap-6 px-4">
          <li>
            <Link
              href="/invoices"
              aria-current={!deletedOnly ? 'page' : undefined}
              className={`block border-b-2 py-3 text-sm font-medium ${!deletedOnly ? 'border-gold text-gold' : 'border-transparent text-ivory/70 hover:text-ivory'}`}
            >
              {H.tabs.current}
            </Link>
          </li>
          <li>
            <Link
              href="/invoices?view=deleted"
              aria-current={deletedOnly ? 'page' : undefined}
              className={`block border-b-2 py-3 text-sm font-medium ${deletedOnly ? 'border-gold text-gold' : 'border-transparent text-ivory/70 hover:text-ivory'}`}
            >
              {H.tabs.deleted}
            </Link>
          </li>
        </ul>
      </nav>

      <form method="get" className="grid gap-3 rounded-lg bg-ivory p-4 sm:grid-cols-2 lg:grid-cols-4">
        {deletedOnly && <input type="hidden" name="view" value="deleted" />}
        <label className="flex flex-col gap-1 text-xs font-medium text-black">{H.from}
          <input type="date" name="from" defaultValue={params.from} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-black">{H.to}
          <input type="date" name="to" defaultValue={params.to} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-black">{H.warehouse}
          <select name="warehouseId" defaultValue={params.warehouseId ?? ''} className={inputClass}>
            <option value="">{H.allWarehouses}</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-black">{H.client}
          <input name="client" defaultValue={params.client} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-black">{H.reference}
          <input name="reference" defaultValue={params.reference} className={inputClass} />
        </label>
        {actor.role === ROLES.ADMIN && (
          <label className="flex flex-col gap-1 text-xs font-medium text-black">{H.seller}
            <input name="seller" defaultValue={params.seller} className={inputClass} />
          </label>
        )}
        <label className="flex flex-col gap-1 text-xs font-medium text-black">{H.payment}
          <select name="paymentMethod" defaultValue={params.paymentMethod ?? ''} className={inputClass}>
            <option value="">{H.allStatuses}</option>
            <option value={PAYMENT_METHODS.CASH}>{MESSAGES.pos.cash}</option>
            <option value={PAYMENT_METHODS.TRANSFER}>{MESSAGES.pos.transfer}</option>
          </select>
        </label>
        {!deletedOnly && (
          <label className="flex flex-col gap-1 text-xs font-medium text-black">{H.status}
            <select name="status" defaultValue={params.status ?? ''} className={inputClass}>
              <option value="">{H.allStatuses}</option>
              <option value="valid">{MESSAGES.invoices.detail.statusLabels.valid}</option>
              <option value="modified">{MESSAGES.invoices.detail.statusLabels.modified}</option>
            </select>
          </label>
        )}
        <div className="flex items-end gap-2">
          <button type="submit" className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:bg-gold-hover">{H.filter}</button>
          <Link href={listHref} className="rounded-md border border-black px-4 py-2 text-sm text-black hover:bg-ivory-dark">{H.clear}</Link>
        </div>
      </form>

      {errorMessage && <p role="alert" className="text-sm text-red-300">{errorMessage}</p>}

      {result && (
        <>
          <div className="overflow-x-auto rounded-lg bg-ivory">
            <table className="min-w-full text-left text-sm text-black">
              <thead className="border-b border-ivory-dark bg-ivory-dark">
                <tr>
                  <th className="px-3 py-2 font-medium">{H.columns.reference}</th>
                  <th className="px-3 py-2 font-medium">{H.columns.date}</th>
                  <th className="px-3 py-2 font-medium">{H.columns.seller}</th>
                  <th className="px-3 py-2 font-medium">{H.columns.client}</th>
                  <th className="px-3 py-2 text-right font-medium">{H.columns.items}</th>
                  <th className="px-3 py-2 text-right font-medium">{H.columns.total}</th>
                  <th className="px-3 py-2 text-right font-medium">{H.columns.totalUsd}</th>
                  <th className="px-3 py-2 font-medium">{H.columns.status}</th>
                  <th className="px-3 py-2 font-medium">{H.columns.action}</th>
                </tr>
              </thead>
              <tbody>
                {result.items.length === 0 && (
                  <tr><td colSpan={9} className="px-3 py-6 text-center text-black/60">{deletedOnly ? H.emptyDeleted : H.empty}</td></tr>
                )}
                {result.items.map((item) => (
                  <tr key={item.reference} className="border-b border-ivory-dark last:border-0">
                    <td className="px-3 py-2 font-mono">{item.reference}</td>
                    <td className="px-3 py-2 tabular-nums">{formatDateTime(new Date(item.createdAt))}</td>
                    <td className="px-3 py-2">{item.sellerUsername}</td>
                    <td className="px-3 py-2">
                      <p>{item.clientName}</p>
                      <p className="font-mono text-xs text-black/60">{item.clientCi}</p>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{item.itemsCount}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCents(item.totalCupCents)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCents(item.totalUsdCents)}</td>
                    <td className="px-3 py-2">
                      <span className={item.status === 'deleted' ? 'text-red-700' : item.status === 'modified' ? 'text-amber-700' : 'text-green-700'}>
                        {MESSAGES.invoices.detail.statusLabels[item.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/invoices/${item.reference}`} className="rounded-md bg-gold px-3 py-1 font-medium text-black hover:bg-gold-hover">{H.columns.action}</Link>
                        {deletedOnly && actor.role === ROLES.ADMIN && (
                          <PermanentDeleteButton reference={item.reference} />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm text-ivory">
            {result.page > 1 ? (
              <Link href={pageHref(params, result.page - 1)} className="rounded-md border border-gold px-3 py-1 text-gold hover:bg-gold hover:text-black">{H.previous}</Link>
            ) : <span />}
            <span>{H.page} {result.page}</span>
            {result.hasNext ? (
              <Link href={pageHref(params, result.page + 1)} className="rounded-md border border-gold px-3 py-1 text-gold hover:bg-gold hover:text-black">{H.next}</Link>
            ) : <span />}
          </div>
        </>
      )}
    </div>
  )
}
