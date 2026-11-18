'use client'

import { useMemo, useState } from 'react'
import type { ReactElement } from 'react'
import { formatCents } from '@/lib/money'
import { MESSAGES } from '@/lib/messages'
import type { CatalogProduct } from '@/types/pos'

interface ProductPickerProps {
  products: CatalogProduct[]
  inCart: Record<string, number>
  unitPriceCupCents: (product: CatalogProduct) => number | null
  unitPriceUsdCents: (product: CatalogProduct) => number | null
  onAdd: (product: CatalogProduct, quantityText: string) => string | null
}

export default function ProductPicker({ products, inCart, unitPriceCupCents, unitPriceUsdCents, onAdd }: ProductPickerProps): ReactElement {
  const [query, setQuery] = useState<string>('')
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (term === '') return products
    return products.filter((product) => product.name.toLowerCase().includes(term) || product.code.toLowerCase().includes(term))
  }, [products, query])

  const handleAdd = (product: CatalogProduct): void => {
    const quantity = quantities[product.code] ?? '1'
    const result = onAdd(product, quantity)
    setError(result)
    if (result === null) setQuantities((current) => ({ ...current, [product.code]: '1' }))
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-black">{MESSAGES.pos.products}</h2>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={MESSAGES.pos.search}
        className="rounded-md border border-ivory-dark bg-ivory px-3 py-2 text-sm text-black focus:border-gold focus:outline-none"
      />
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-ivory-dark bg-ivory">
        {filtered.length === 0 && <p className="p-4 text-sm text-black/60">{MESSAGES.pos.noProducts}</p>}
        <ul className="divide-y divide-ivory-dark">
          {filtered.map((product) => {
            const soldOut = product.stock === 0
            const available = Math.max(0, product.stock - (inCart[product.code] ?? 0))
            const cupPrice = unitPriceCupCents(product)
            const usdPrice = unitPriceUsdCents(product)
            return (
              <li key={product.code} className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-black">{product.name}</p>
                  <p className="font-mono text-xs text-black/60">
                    {product.code} · {MESSAGES.pos.stock}: {product.stock} · {MESSAGES.pos.available}:{' '}
                    <span className={available === 0 ? 'font-semibold text-red-700' : 'font-semibold text-black'}>{available}</span>
                  </p>
                  {cupPrice !== null && usdPrice !== null && (
                    <p className="text-xs text-black/75 tabular-nums">{formatCents(cupPrice)} CUP · {formatCents(usdPrice)} USD</p>
                  )}
                </div>
                {soldOut ? (
                  <span className="rounded-md border border-ivory-dark px-3 py-1 text-xs text-black/60">{MESSAGES.pos.soldOut}</span>
                ) : available === 0 ? (
                  <span className="rounded-md border border-ivory-dark px-3 py-1 text-xs text-black/60">{MESSAGES.pos.allInCart}</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-xs text-black/75">
                      {MESSAGES.pos.qty}
                      <input
                        value={quantities[product.code] ?? '1'}
                        onChange={(event) => setQuantities((current) => ({ ...current, [product.code]: event.target.value }))}
                        inputMode="numeric"
                        max={available}
                        aria-label={`${MESSAGES.pos.qty} ${product.name}`}
                        className="min-h-11 w-16 rounded-md border border-ivory-dark bg-ivory px-2 py-1 text-right text-sm text-black focus:border-gold focus:outline-none"
                      />
                    </label>
                    <button type="button" onClick={() => handleAdd(product)} className="min-h-11 rounded-md bg-gold px-3 py-2 text-sm font-medium text-black hover:bg-gold-hover">
                      {MESSAGES.pos.add}
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
