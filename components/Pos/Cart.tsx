'use client'

import type { ReactElement } from 'react'
import { formatCents } from '@/lib/money'
import { MESSAGES } from '@/lib/messages'

export interface CartRow {
  code: string
  name: string
  stock: number
  quantity: number
  unitPriceCupCents: number
  unitPriceUsdCents: number
  subtotalCupCents: number
}

interface CartProps {
  rows: CartRow[]
  totalCupCents: number
  totalUsdCents: number
  onQuantityChange: (code: string, quantityText: string) => string | null
  onRemove: (code: string) => void
}

export default function Cart({ rows, totalCupCents, totalUsdCents, onQuantityChange, onRemove }: CartProps): ReactElement {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-black">{MESSAGES.pos.cart}</h2>
      <div className="flex flex-col gap-3 md:hidden">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-ivory-dark bg-ivory px-3 py-6 text-center text-sm text-black/60">
            {MESSAGES.pos.cartEmpty}
          </div>
        ) : rows.map((row) => (
          <article key={row.code} className="rounded-lg border border-ivory-dark bg-ivory p-3 text-black">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="break-words font-medium">{row.name}</p>
                <p className="break-all font-mono text-xs text-black/60">{row.code}</p>
              </div>
              <button type="button" onClick={() => onRemove(row.code)} className="min-h-11 shrink-0 rounded-md border border-red-300 px-3 py-2 text-xs text-red-700 hover:bg-red-50">
                {MESSAGES.pos.remove}
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <label className="flex flex-col gap-1 text-xs text-black/70">
                {MESSAGES.pos.qty}
                <input
                  defaultValue={row.quantity}
                  key={`${row.code}-${row.quantity}-mobile`}
                  inputMode="numeric"
                  max={row.stock}
                  aria-label={`${MESSAGES.pos.qty} ${row.name}`}
                  onBlur={(event) => {
                    const error = onQuantityChange(row.code, event.target.value)
                    if (error) event.target.value = String(row.quantity)
                  }}
                  className="min-h-11 w-full rounded-md border border-ivory-dark bg-ivory px-2 py-1 text-right text-sm text-black focus:border-gold focus:outline-none"
                />
                <span className={`tabular-nums ${row.stock - row.quantity === 0 ? 'text-red-700' : 'text-black/60'}`}>
                  {MESSAGES.pos.availableShort} {row.stock - row.quantity}
                </span>
              </label>
              <dl className="grid content-start gap-2 text-right text-xs">
                <div>
                  <dt className="text-black/60">{MESSAGES.pos.columns.price}</dt>
                  <dd className="tabular-nums">{formatCents(row.unitPriceCupCents)} CUP</dd>
                </div>
                <div>
                  <dt className="text-black/60">{MESSAGES.pos.columns.subtotal}</dt>
                  <dd className="font-semibold tabular-nums">{formatCents(row.subtotalCupCents)} CUP</dd>
                </div>
              </dl>
            </div>
            <p className="mt-2 text-right text-xs tabular-nums text-black/60">
              {MESSAGES.pos.columns.refUsd}: {formatCents(row.unitPriceUsdCents)} USD
            </p>
          </article>
        ))}
      </div>
      <div className="hidden overflow-x-auto rounded-lg border border-ivory-dark bg-ivory md:block">
        <table className="min-w-full text-left text-sm text-black">
          <thead className="border-b border-ivory-dark bg-ivory-dark">
            <tr>
              <th className="px-3 py-2 font-medium">{MESSAGES.pos.columns.product}</th>
              <th className="px-3 py-2 text-right font-medium">{MESSAGES.pos.columns.qty}</th>
              <th className="px-3 py-2 text-right font-medium">{MESSAGES.pos.columns.price}</th>
              <th className="px-3 py-2 text-right font-medium">{MESSAGES.pos.columns.refUsd}</th>
              <th className="px-3 py-2 text-right font-medium">{MESSAGES.pos.columns.subtotal}</th>
              <th className="px-3 py-2 font-medium">{MESSAGES.pos.columns.action}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-black/60">{MESSAGES.pos.cartEmpty}</td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.code} className="border-b border-ivory-dark last:border-0">
                <td className="px-3 py-2">
                  <p className="font-medium">{row.name}</p>
                  <p className="font-mono text-xs text-black/60">{row.code}</p>
                </td>
                <td className="px-3 py-2 text-right">
                  <input
                    defaultValue={row.quantity}
                    key={`${row.code}-${row.quantity}`}
                    inputMode="numeric"
                    max={row.stock}
                    aria-label={`${MESSAGES.pos.qty} ${row.name}`}
                    onBlur={(event) => {
                      const error = onQuantityChange(row.code, event.target.value)
                      if (error) event.target.value = String(row.quantity)
                    }}
                    className="w-16 rounded-md border border-ivory-dark bg-ivory px-2 py-1 text-right focus:border-gold focus:outline-none"
                  />
                  <p className={`mt-1 text-xs tabular-nums ${row.stock - row.quantity === 0 ? 'text-red-700' : 'text-black/60'}`}>
                    {MESSAGES.pos.availableShort} {row.stock - row.quantity}
                  </p>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCents(row.unitPriceCupCents)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCents(row.unitPriceUsdCents)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCents(row.subtotalCupCents)}</td>
                <td className="px-3 py-2">
                  <button type="button" onClick={() => onRemove(row.code)} className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50">
                    {MESSAGES.pos.remove}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col items-end gap-1 rounded-lg border border-gold bg-black p-4">
        <p className="text-sm text-ivory/80">{MESSAGES.pos.total}</p>
        <p className="text-2xl font-semibold tabular-nums text-gold">{formatCents(totalCupCents)} CUP</p>
        <p className="text-sm tabular-nums text-ivory">{MESSAGES.pos.totalUsd}: {formatCents(totalUsdCents)} USD</p>
      </div>
    </section>
  )
}
