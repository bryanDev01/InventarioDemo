'use client'

import { useState } from 'react'
import type { FormEvent, ReactElement } from 'react'
import { apiRequest } from '@/lib/apiClient'
import { MESSAGES } from '@/lib/messages'
import type { ProductRecord } from '@/types/product'
import type { CreateStockMovementPayload, ManualMovementType } from '@/types/stockMovement'
import type { WarehouseOption } from '@/types/warehouse'

interface MovementFormProps {
  warehouses: WarehouseOption[]
  initialProducts: ProductRecord[]
  onSaved: () => void
  onCancel: () => void
}

const F = MESSAGES.stockMovements.form

const TYPE_OPTIONS: readonly ManualMovementType[] = ['entry', 'exit', 'transfer']

export default function MovementForm({ warehouses, initialProducts, onSaved, onCancel }: MovementFormProps): ReactElement {
  const [type, setType] = useState<ManualMovementType>('entry')
  const [warehouseId, setWarehouseId] = useState<string>(warehouses[0]?.id ?? '')
  const [destinationId, setDestinationId] = useState<string>(
    warehouses.find((warehouse) => warehouse.id !== warehouses[0]?.id)?.id ?? ''
  )
  const [products, setProducts] = useState<ProductRecord[]>(initialProducts)
  const [productCode, setProductCode] = useState<string>('')
  const [quantity, setQuantity] = useState<string>('')
  const [observation, setObservation] = useState<string>('')
  const [loadingProducts, setLoadingProducts] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const inputClass = 'rounded-md border border-ivory-dark px-3 py-2 font-normal text-black focus:border-gold focus:outline-none'

  const loadProducts = async (id: string): Promise<void> => {
    if (id === '') {
      setProducts([])
      return
    }
    setLoadingProducts(true)
    setError(null)
    try {
      const data = await apiRequest<ProductRecord[]>(`/api/warehouses/${encodeURIComponent(id)}/products`)
      setProducts(data ?? [])
    } catch (err) {
      setProducts([])
      setError(err instanceof Error ? err.message : MESSAGES.common.unexpectedError)
    } finally {
      setLoadingProducts(false)
    }
  }

  const handleWarehouseChange = (nextId: string): void => {
    setWarehouseId(nextId)
    setProductCode('')
    if (destinationId === nextId || destinationId === '') {
      setDestinationId(warehouses.find((warehouse) => warehouse.id !== nextId)?.id ?? '')
    }
    void loadProducts(nextId)
  }

  const handleTypeChange = (nextType: ManualMovementType): void => {
    setType(nextType)
    setError(null)
    if (nextType === 'transfer' && (destinationId === '' || destinationId === warehouseId)) {
      setDestinationId(warehouses.find((warehouse) => warehouse.id !== warehouseId)?.id ?? '')
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (loading) return
    setError(null)
    setLoading(true)
    try {
      const payload: CreateStockMovementPayload = {
        type,
        warehouseId,
        destinationWarehouseId: type === 'transfer' ? destinationId : undefined,
        productCode,
        quantity,
        observation: observation || null,
      }
      await apiRequest<never>('/api/stock-movements', { method: 'POST', body: JSON.stringify(payload) })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : MESSAGES.common.unexpectedError)
      setLoading(false)
    }
  }

  const destinationOptions = warehouses.filter((warehouse) => warehouse.id !== warehouseId)
  const canSubmit = !loading && !loadingProducts && warehouseId !== '' && productCode !== ''
    && (type !== 'transfer' || destinationId !== '')

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium text-black/75">
        {F.type}
        <select
          value={type}
          onChange={(event) => handleTypeChange(event.target.value as ManualMovementType)}
          className={inputClass}
        >
          {TYPE_OPTIONS.map((option) => (
            <option key={option} value={option}>{MESSAGES.stockMovements.history.typeLabels[option]}</option>
          ))}
        </select>
      </label>

      <div className={`grid gap-4 ${type === 'transfer' ? 'sm:grid-cols-2' : ''}`}>
        <label className="flex flex-col gap-1 text-sm font-medium text-black/75">
          {type === 'transfer' ? F.origin : F.warehouse}
          <select
            value={warehouseId}
            onChange={(event) => handleWarehouseChange(event.target.value)}
            required
            className={inputClass}
          >
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
            ))}
          </select>
        </label>
        {type === 'transfer' && (
          <label className="flex flex-col gap-1 text-sm font-medium text-black/75">
            {F.destination}
            <select
              value={destinationId}
              onChange={(event) => setDestinationId(event.target.value)}
              required
              className={inputClass}
            >
              <option value="">{F.destinationPlaceholder}</option>
              {destinationOptions.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {type === 'transfer' && <p className="text-xs text-black/60">{F.transferHelp}</p>}

      <label className="flex flex-col gap-1 text-sm font-medium text-black/75">
        {F.product}
        <select
          value={productCode}
          onChange={(event) => setProductCode(event.target.value)}
          required
          disabled={loadingProducts || products.length === 0}
          className={inputClass}
        >
          <option value="">{F.productPlaceholder}</option>
          {products.map((product) => (
            <option key={product.code} value={product.code}>
              {product.code} · {product.name} — {F.stock}: {product.stock}
            </option>
          ))}
        </select>
        {loadingProducts && <span className="text-xs font-normal text-black/60">{F.loadingProducts}</span>}
        {!loadingProducts && products.length === 0 && <span className="text-xs font-normal text-red-600">{F.noProducts}</span>}
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-black/75">
        {F.quantity}
        <input
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          inputMode="numeric"
          required
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-black/75">
        {F.observation}
        <textarea
          value={observation}
          onChange={(event) => setObservation(event.target.value)}
          maxLength={300}
          rows={2}
          className={inputClass}
        />
        <span className="text-xs font-normal text-black/60">{F.observationHelp}</span>
      </label>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
        <button type="button" onClick={onCancel} disabled={loading} className="min-h-11 w-full rounded-md border border-ivory-dark px-4 py-2 text-sm hover:bg-ivory-dark disabled:opacity-50 sm:w-auto">
          {MESSAGES.common.cancel}
        </button>
        <button type="submit" disabled={!canSubmit} className="min-h-11 w-full rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:bg-gold-hover disabled:opacity-50 sm:w-auto">
          {loading ? F.submitting : F.submit}
        </button>
      </div>
    </form>
  )
}
