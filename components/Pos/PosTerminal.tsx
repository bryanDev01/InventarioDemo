'use client'

import { useMemo, useState, useSyncExternalStore } from 'react'
import type { ChangeEvent, ReactElement } from 'react'
import ConfirmDialog from '@/components/Common/ConfirmDialog'
import Cart from '@/components/Pos/Cart'
import type { CartRow } from '@/components/Pos/Cart'
import ComplementaryDataDialog from '@/components/Pos/ComplementaryDataDialog'
import type { ComplementaryData } from '@/components/Pos/ComplementaryDataDialog'
import ProductPicker from '@/components/Pos/ProductPicker'
import VoucherPreview from '@/components/Print/VoucherPreview'
import { apiRequest } from '@/lib/apiClient'
import {
  calculateLineSubtotalCupCents,
  calculateUnitPriceCupCents,
  convertCupCentsToUsdCents,
  parseRateToCents,
} from '@/lib/money'
import { MESSAGES } from '@/lib/messages'
import { isValidCi, isValidClientName, parseQuantity } from '@/lib/validators'
import type { CatalogProduct, PosCatalog } from '@/types/pos'
import type { InvoiceRecord } from '@/types/invoice'

const RATE_STORAGE_KEY = 'inventaria.pos.rate'
const RATE_CHANGE_EVENT = 'inventaria-pos-rate-change'

const subscribeToRate = (onChange: () => void): (() => void) => {
  window.addEventListener(RATE_CHANGE_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(RATE_CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

const getStoredRate = (): string => window.localStorage.getItem(RATE_STORAGE_KEY) ?? ''

const getServerRate = (): string => ''

const storeRate = (value: string): void => {
  window.localStorage.setItem(RATE_STORAGE_KEY, value)
  window.dispatchEvent(new Event(RATE_CHANGE_EVENT))
}

interface CartLine {
  code: string
  quantity: number
}

interface PosTerminalProps {
  initial: PosCatalog
}

export default function PosTerminal({ initial }: PosTerminalProps): ReactElement {
  const [warehouseId, setWarehouseId] = useState<string | null>(initial.warehouseId)
  const [products, setProducts] = useState<CatalogProduct[]>(initial.products)
  const rateText = useSyncExternalStore(subscribeToRate, getStoredRate, getServerRate)
  const [cart, setCart] = useState<CartLine[]>([])
  const [clientName, setClientName] = useState<string>('')
  const [clientCi, setClientCi] = useState<string>('')
  const [pendingWarehouse, setPendingWarehouse] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState<boolean>(false)
  const [voucher, setVoucher] = useState<{ invoice: InvoiceRecord; priceChanged: boolean } | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const rateCents = useMemo(() => parseRateToCents(rateText), [rateText])

  const inCart = useMemo<Record<string, number>>(
    () => cart.reduce<Record<string, number>>((acc, line) => {
      acc[line.code] = (acc[line.code] ?? 0) + line.quantity
      return acc
    }, {}),
    [cart],
  )

  const unitCupOf = (product: CatalogProduct): number | null =>
    rateCents === null ? null : calculateUnitPriceCupCents(product.basePriceUsdCents, rateCents)

  const unitUsdOf = (product: CatalogProduct): number | null => {
    const unitCup = unitCupOf(product)
    return unitCup === null || rateCents === null ? null : convertCupCentsToUsdCents(unitCup, rateCents)
  }

  const cartRows: CartRow[] = cart.flatMap((line) => {
    const product = products.find((item) => item.code === line.code)
    if (!product) return []
    const unitCup = unitCupOf(product) ?? 0
    return [{
      code: product.code,
      name: product.name,
      stock: product.stock,
      quantity: line.quantity,
      unitPriceCupCents: unitCup,
      unitPriceUsdCents: unitUsdOf(product) ?? 0,
      subtotalCupCents: calculateLineSubtotalCupCents(line.quantity, unitCup),
    }]
  })

  const totalCupCents = cartRows.reduce((sum, row) => sum + row.subtotalCupCents, 0)
  const totalUsdCents = rateCents === null ? 0 : convertCupCentsToUsdCents(totalCupCents, rateCents)
  const canInvoice = cartRows.length > 0 && rateCents !== null && warehouseId !== null
    && isValidClientName(clientName) && isValidCi(clientCi)

  const addToCart = (product: CatalogProduct, quantityText: string): string | null => {
    if (rateCents === null) return MESSAGES.pos.rateRequired
    const quantity = parseQuantity(quantityText)
    if (quantity === null) return MESSAGES.validation.invalidQuantity
    const inCart = cart.find((line) => line.code === product.code)?.quantity ?? 0
    if (inCart + quantity > product.stock) return MESSAGES.pos.exceedsStock
    setCart((current) => {
      const existing = current.find((line) => line.code === product.code)
      if (existing) return current.map((line) => (line.code === product.code ? { ...line, quantity: line.quantity + quantity } : line))
      return [...current, { code: product.code, quantity }]
    })
    return null
  }

  const changeQuantity = (code: string, quantityText: string): string | null => {
    const quantity = parseQuantity(quantityText)
    if (quantity === null) return MESSAGES.validation.invalidQuantity
    const product = products.find((item) => item.code === code)
    if (!product || quantity > product.stock) return MESSAGES.pos.exceedsStock
    setCart((current) => current.map((line) => (line.code === code ? { ...line, quantity } : line)))
    return null
  }

  const removeLine = (code: string): void => {
    setCart((current) => current.filter((line) => line.code !== code))
  }

  const loadWarehouse = async (id: string): Promise<void> => {
    setMessage(null)
    try {
      const data = await apiRequest<PosCatalog>(`/api/pos/catalog?warehouseId=${encodeURIComponent(id)}`)
      if (!data) return
      setWarehouseId(data.warehouseId)
      setProducts(data.products)
      setCart([])
    } catch (err) {
      setMessage(err instanceof Error ? err.message : MESSAGES.common.unexpectedError)
    }
  }

  const refreshProducts = async (): Promise<void> => {
    if (warehouseId === null) return
    try {
      const data = await apiRequest<PosCatalog>(`/api/pos/catalog?warehouseId=${encodeURIComponent(warehouseId)}`)
      if (!data) return
      setProducts(data.products)
      setCart((current) => current.flatMap((line) => {
        const product = data.products.find((item) => item.code === line.code)
        if (!product || product.stock === 0) return []
        return [{ code: line.code, quantity: Math.min(line.quantity, product.stock) }]
      }))
    } catch {
      setMessage(MESSAGES.common.unexpectedError)
    }
  }

  const handleWarehouseChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const nextId = event.target.value
    if (nextId === warehouseId) return
    if (cart.length > 0) {
      setPendingWarehouse(nextId)
      return
    }
    void loadWarehouse(nextId)
  }

  const submitInvoice = async (data: ComplementaryData): Promise<string | null> => {
    if (warehouseId === null || rateCents === null) return MESSAGES.pos.rateRequired
    try {
      const invoice = await apiRequest<InvoiceRecord>('/api/invoices', {
        method: 'POST',
        body: JSON.stringify({
          requestId: data.requestId,
          warehouseId,
          rate: rateText,
          clientName,
          clientCi,
          transporterName: data.transporterName,
          transporterCi: data.transporterCi,
          vehiclePlate: data.vehiclePlate,
          paymentMethod: data.paymentMethod,
          lines: cart.map((line) => ({ code: line.code, quantity: String(line.quantity) })),
        }),
      })
      if (!invoice) return MESSAGES.invoices.processFailed
      const priceChanged = invoice.lines.some((line) => {
        const product = products.find((item) => item.code === line.code)
        return product !== undefined && product.basePriceUsdCents !== line.basePriceUsdCents
      })
      setDialogOpen(false)
      setVoucher({ invoice, priceChanged })
      setCart([])
      setClientName('')
      setClientCi('')
      await refreshProducts()
      return null
    } catch (err) {
      return err instanceof Error ? err.message : MESSAGES.common.unexpectedError
    }
  }

  if (warehouseId === null) {
    return <p className="rounded-lg bg-ivory p-6 text-black">{MESSAGES.pos.noWarehouses}</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-gold">{MESSAGES.pos.title}</h1>

      <section className="flex flex-col gap-4 rounded-lg bg-ivory p-5">
        <h2 className="text-lg font-semibold text-black">{MESSAGES.pos.step1}</h2>
        <p className="text-sm text-black/75">{MESSAGES.pos.rateHelp}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium text-black">
            {MESSAGES.pos.rate}
            <input
              value={rateText}
              onChange={(event) => storeRate(event.target.value.replace(/[^0-9.]/g, ''))}
              inputMode="decimal"
              placeholder="0.00"
              className="rounded-md border border-ivory-dark bg-ivory px-3 py-2 font-normal tabular-nums text-black focus:border-gold focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-black">
            {MESSAGES.pos.warehouse}
            <select
              value={warehouseId}
              onChange={handleWarehouseChange}
              className="rounded-md border border-ivory-dark bg-ivory px-3 py-2 font-normal text-black focus:border-gold focus:outline-none"
            >
              {initial.warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>{warehouse.name} ({warehouse.id})</option>
              ))}
            </select>
          </label>
        </div>
        {rateText !== '' && rateCents === null && <p role="alert" className="text-sm text-red-600">{MESSAGES.invoices.invalidRate}</p>}
      </section>

      {message && <p role="alert" className="text-sm text-red-600">{message}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg bg-ivory p-5">
          <ProductPicker
            products={products}
            inCart={inCart}
            unitPriceCupCents={unitCupOf}
            unitPriceUsdCents={unitUsdOf}
            onAdd={addToCart}
          />
        </div>

        <div className="flex flex-col gap-5 rounded-lg bg-ivory p-5">
          <Cart
            rows={cartRows}
            totalCupCents={totalCupCents}
            totalUsdCents={totalUsdCents}
            onQuantityChange={changeQuantity}
            onRemove={removeLine}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium text-black">
              {MESSAGES.pos.clientName}
              <input value={clientName} onChange={(event) => setClientName(event.target.value)} maxLength={120} className="rounded-md border border-ivory-dark bg-ivory px-3 py-2 font-normal text-black focus:border-gold focus:outline-none" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-black">
              {MESSAGES.pos.clientCi}
              <input value={clientCi} onChange={(event) => setClientCi(event.target.value.replace(/\D/g, ''))} inputMode="numeric" maxLength={11} className="rounded-md border border-ivory-dark bg-ivory px-3 py-2 font-normal tabular-nums text-black focus:border-gold focus:outline-none" />
            </label>
          </div>

          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            disabled={!canInvoice}
            className="rounded-md bg-gold px-4 py-3 text-base font-semibold text-black hover:bg-gold-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            {MESSAGES.pos.invoice}
          </button>
        </div>
      </div>

      {pendingWarehouse && (
        <ConfirmDialog
          title={MESSAGES.pos.warehouse}
          message={MESSAGES.pos.warehouseChangeConfirm}
          confirmLabel={MESSAGES.pos.continueChange}
          busy={false}
          onConfirm={() => {
            const id = pendingWarehouse
            setPendingWarehouse(null)
            void loadWarehouse(id)
          }}
          onCancel={() => setPendingWarehouse(null)}
        />
      )}

      {dialogOpen && (
        <ComplementaryDataDialog
          totalCupCents={totalCupCents}
          totalUsdCents={totalUsdCents}
          onSubmit={submitInvoice}
          onCancel={() => setDialogOpen(false)}
        />
      )}

      {voucher && (
        <VoucherPreview
          invoice={voucher.invoice}
          priceChanged={voucher.priceChanged}
          onClose={() => setVoucher(null)}
        />
      )}
    </div>
  )
}
