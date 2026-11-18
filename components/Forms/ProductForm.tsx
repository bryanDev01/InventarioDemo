'use client'

import { useState } from 'react'
import type { FormEvent, ReactElement } from 'react'
import { apiRequest } from '@/lib/apiClient'
import { formatCents } from '@/lib/money'
import { MESSAGES } from '@/lib/messages'
import type { ProductRecord, RegisterProductPayload, UpdateInventoryPayload } from '@/types/product'

interface ProductFormProps {
  warehouseId: string
  product: ProductRecord | null
  onSaved: () => void
  onCancel: () => void
}

export default function ProductForm({ warehouseId, product, onSaved, onCancel }: ProductFormProps): ReactElement {
  const isEdit = product !== null
  const [code, setCode] = useState<string>('')
  const [name, setName] = useState<string>(product?.name ?? '')
  const [basePrice, setBasePrice] = useState<string>(product ? (product.basePriceUsdCents / 100).toFixed(2) : '')
  const [stock, setStock] = useState<string>(product ? String(product.stock) : '0')
  const [observation, setObservation] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (loading) return
    setError(null)
    setLoading(true)
    try {
      if (isEdit && product) {
        const payload: UpdateInventoryPayload = { name, basePrice, stock, observation: observation || null }
        await apiRequest<never>(`/api/warehouses/${warehouseId}/products/${encodeURIComponent(product.code)}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
      } else {
        const payload: RegisterProductPayload = { code: code || null, name, basePrice, stock }
        await apiRequest<{ code: string }>(`/api/warehouses/${warehouseId}/products`, {
          method: 'POST',
          body: JSON.stringify(payload),
        })
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : MESSAGES.common.unexpectedError)
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {isEdit && product && (
        <p className="text-xs text-black/60">{MESSAGES.ui.inventory.codeReadonly}: <span className="font-mono">{product.code}</span></p>
      )}
      {!isEdit && (
        <label className="flex flex-col gap-1 text-sm font-medium text-black/75">
          {MESSAGES.ui.inventory.code}
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            maxLength={30}
            className="rounded-md border border-ivory-dark px-3 py-2 font-mono font-normal focus:border-gold focus:outline-none"
          />
          <span className="text-xs font-normal text-black/60">{MESSAGES.ui.inventory.codeHelp}</span>
        </label>
      )}
      <label className="flex flex-col gap-1 text-sm font-medium text-black/75">
        {MESSAGES.ui.inventory.name}
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={160}
          className="rounded-md border border-ivory-dark px-3 py-2 font-normal focus:border-gold focus:outline-none"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-black/75">
          {MESSAGES.ui.inventory.basePrice}
          <input
            value={basePrice}
            onChange={(event) => setBasePrice(event.target.value)}
            inputMode="decimal"
            required
            placeholder="0.00"
            className="rounded-md border border-ivory-dark px-3 py-2 font-normal focus:border-gold focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-black/75">
          {MESSAGES.ui.inventory.stock}
          <input
            value={stock}
            onChange={(event) => setStock(event.target.value)}
            inputMode="numeric"
            required
            className="rounded-md border border-ivory-dark px-3 py-2 font-normal focus:border-gold focus:outline-none"
          />
        </label>
      </div>
      {isEdit && (
        <label className="flex flex-col gap-1 text-sm font-medium text-black/75">
          {MESSAGES.ui.inventory.observation}
          <input
            value={observation}
            onChange={(event) => setObservation(event.target.value)}
            maxLength={200}
            className="rounded-md border border-ivory-dark px-3 py-2 font-normal focus:border-gold focus:outline-none"
          />
        </label>
      )}
      {product && <p className="text-xs text-black/60">{formatCents(product.basePriceUsdCents)} USD</p>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
        <button type="button" onClick={onCancel} disabled={loading} className="min-h-11 w-full rounded-md border border-ivory-dark px-4 py-2 text-sm hover:bg-ivory-dark disabled:opacity-50 sm:w-auto">
          {MESSAGES.common.cancel}
        </button>
        <button type="submit" disabled={loading} className="min-h-11 w-full rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:bg-gold-hover disabled:opacity-50 sm:w-auto">
          {loading ? MESSAGES.common.saving : MESSAGES.common.save}
        </button>
      </div>
    </form>
  )
}
