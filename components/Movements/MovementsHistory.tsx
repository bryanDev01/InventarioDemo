'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { ReactElement } from 'react'
import Modal from '@/components/Common/Modal'
import MovementForm from '@/components/Forms/MovementForm'
import { apiRequest } from '@/lib/apiClient'
import { MOVEMENT_TYPES } from '@/lib/constants'
import { formatDateTime } from '@/lib/dates'
import { MESSAGES } from '@/lib/messages'
import type { MovementType } from '@/lib/constants'
import type { ProductRecord } from '@/types/product'
import type { StockMovementListResult } from '@/types/stockMovement'
import type { WarehouseOption } from '@/types/warehouse'

interface MovementsHistoryProps {
  result: StockMovementListResult | null
  warehouses: WarehouseOption[]
  params: Record<string, string | undefined>
  errorMessage: string | null
}

const H = MESSAGES.stockMovements.history

const TYPE_OPTIONS: readonly MovementType[] = [
  MOVEMENT_TYPES.ENTRY,
  MOVEMENT_TYPES.EXIT,
  MOVEMENT_TYPES.TRANSFER,
  MOVEMENT_TYPES.ADJUSTMENT,
  MOVEMENT_TYPES.INVOICE_EXIT,
]

const pageHref = (params: Record<string, string | undefined>, page: number): string => {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== 'page') query.set(key, value)
  }
  query.set('page', String(page))
  return `/warehouses/movements?${query.toString()}`
}

export default function MovementsHistory({ result, warehouses, params, errorMessage }: MovementsHistoryProps): ReactElement {
  const router = useRouter()
  const [creating, setCreating] = useState<boolean>(false)
  const [opening, setOpening] = useState<boolean>(false)
  const [initialProducts, setInitialProducts] = useState<ProductRecord[] | null>(null)
  const [openError, setOpenError] = useState<string | null>(null)
  const inputClass = 'rounded-md border border-ivory-dark bg-ivory px-3 py-2 text-sm text-black focus:border-gold focus:outline-none'

  const close = (): void => {
    setCreating(false)
    setInitialProducts(null)
  }

  const handleOpen = async (): Promise<void> => {
    if (opening) return
    setOpenError(null)
    const first = warehouses[0]
    if (!first) {
      setInitialProducts([])
      setCreating(true)
      return
    }
    setOpening(true)
    try {
      const products = await apiRequest<ProductRecord[]>(`/api/warehouses/${encodeURIComponent(first.id)}/products`)
      setInitialProducts(products ?? [])
      setCreating(true)
    } catch (err) {
      setOpenError(err instanceof Error ? err.message : MESSAGES.common.unexpectedError)
    } finally {
      setOpening(false)
    }
  }

  const handleSaved = (): void => {
    close()
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-gold">{H.title}</h1>
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={handleOpen}
            disabled={opening}
            className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:bg-gold-hover disabled:opacity-50"
          >
            {opening ? MESSAGES.stockMovements.form.loadingProducts : H.newMovement}
          </button>
          {openError && <p role="alert" className="text-xs text-red-300">{openError}</p>}
        </div>
      </div>

      <form method="get" className="grid gap-3 rounded-lg bg-ivory p-4 sm:grid-cols-2 lg:grid-cols-3">
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
        <label className="flex flex-col gap-1 text-xs font-medium text-black">{H.product}
          <input name="product" defaultValue={params.product} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-black">{H.type}
          <select name="type" defaultValue={params.type ?? ''} className={inputClass}>
            <option value="">{H.allTypes}</option>
            {TYPE_OPTIONS.map((type) => (
              <option key={type} value={type}>{H.typeLabels[type]}</option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button type="submit" className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:bg-gold-hover">{H.filter}</button>
          <Link href="/warehouses/movements" className="rounded-md border border-black px-4 py-2 text-sm text-black hover:bg-ivory-dark">{H.clear}</Link>
        </div>
      </form>

      {errorMessage && <p role="alert" className="text-sm text-red-300">{errorMessage}</p>}

      {result && (
        <>
          <div className="overflow-x-auto rounded-lg bg-ivory">
            <table className="min-w-full text-left text-sm text-black">
              <thead className="border-b border-ivory-dark bg-ivory-dark">
                <tr>
                  <th className="px-3 py-2 font-medium">{H.columns.date}</th>
                  <th className="px-3 py-2 font-medium">{H.columns.type}</th>
                  <th className="px-3 py-2 font-medium">{H.columns.warehouse}</th>
                  <th className="px-3 py-2 font-medium">{H.columns.product}</th>
                  <th className="px-3 py-2 text-right font-medium">{H.columns.quantity}</th>
                  <th className="px-3 py-2 text-right font-medium">{H.columns.stockAfter}</th>
                  <th className="px-3 py-2 font-medium">{H.columns.user}</th>
                  <th className="px-3 py-2 font-medium">{H.columns.observation}</th>
                </tr>
              </thead>
              <tbody>
                {result.items.length === 0 && (
                  <tr><td colSpan={8} className="px-3 py-6 text-center text-black/60">{H.empty}</td></tr>
                )}
                {result.items.map((item) => (
                  <tr key={item.id} className="border-b border-ivory-dark last:border-0 align-top">
                    <td className="px-3 py-2 tabular-nums">{formatDateTime(new Date(item.createdAt))}</td>
                    <td className={`px-3 py-2 ${item.type === 'entry' ? 'text-green-700' : item.type === 'invoice_exit' ? 'text-red-700' : ''}`}>
                      {H.typeLabels[item.type] ?? item.type}
                    </td>
                    <td className="px-3 py-2">
                      <p>{item.warehouseName}</p>
                      <p className="font-mono text-xs text-black/60">{item.warehouseId}</p>
                    </td>
                    <td className="px-3 py-2">
                      <p>{item.productName}</p>
                      <p className="font-mono text-xs text-black/60">{item.productCode}</p>
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums ${item.quantity > 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {item.quantity > 0 ? '+' : ''}{item.quantity}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{item.stockAfter}</td>
                    <td className="px-3 py-2">{item.username}</td>
                    <td className="max-w-xs px-3 py-2 break-words">{item.observation ?? '—'}</td>
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

      {creating && initialProducts !== null && (
        <Modal title={MESSAGES.stockMovements.form.title} onClose={close} wide>
          <MovementForm warehouses={warehouses} initialProducts={initialProducts} onSaved={handleSaved} onCancel={close} />
        </Modal>
      )}
    </div>
  )
}
