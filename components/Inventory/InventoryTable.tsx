'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import type { ReactElement } from 'react'
import ConfirmDialog from '@/components/Common/ConfirmDialog'
import InventoryImportWizard from '@/components/Inventory/InventoryImportWizard'
import Modal from '@/components/Common/Modal'
import ProductForm from '@/components/Forms/ProductForm'
import { apiRequest } from '@/lib/apiClient'
import { formatCents } from '@/lib/money'
import { MESSAGES } from '@/lib/messages'
import type { ProductRecord } from '@/types/product'
import type { WarehouseOption } from '@/types/warehouse'
import type { InventoryImportResult } from '@/types/inventoryImport'

interface InventoryTableProps {
  warehouse: WarehouseOption
  products: ProductRecord[]
  warehouses: WarehouseOption[]
  openImport?: boolean
}

type ModalState =
  | { kind: 'create' }
  | { kind: 'edit'; product: ProductRecord }
  | { kind: 'remove'; product: ProductRecord }
  | { kind: 'import' }
  | null

export default function InventoryTable({ warehouse, products, warehouses, openImport = false }: InventoryTableProps): ReactElement {
  const router = useRouter()
  const [modal, setModal] = useState<ModalState>(null)
  const [query, setQuery] = useState<string>('')
  const [busy, setBusy] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const activeModal: ModalState = openImport ? { kind: 'import' } : modal

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (term === '') return products
    return products.filter((product) => product.name.toLowerCase().includes(term) || product.code.toLowerCase().includes(term))
  }, [products, query])

  const close = (): void => {
    setModal(null)
    if (openImport) router.replace(`/inventory?warehouse=${encodeURIComponent(warehouse.id)}`)
  }

  const handleSaved = (): void => {
    close()
    router.refresh()
  }

  const handleImported = (result: InventoryImportResult): void => {
    close()
    setSuccess(MESSAGES.ui.inventory.import.success(result.imported, result.skipped))
    router.refresh()
  }

  const handleRemove = async (product: ProductRecord): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await apiRequest<never>(`/api/warehouses/${warehouse.id}/products/${encodeURIComponent(product.code)}`, { method: 'DELETE' })
      close()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : MESSAGES.common.unexpectedError)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-black sm:text-2xl">{MESSAGES.ui.inventory.title}</h1>
          <p className="break-words text-sm text-black/75">{warehouse.name} · {warehouse.id}</p>
        </div>
        <div className="flex flex-col gap-2 min-[420px]:flex-row min-[420px]:flex-wrap min-[420px]:items-center sm:justify-end sm:gap-3">
          <Link href="/warehouses" className="min-h-11 inline-flex items-center text-sm text-black/75 hover:text-black">
            {MESSAGES.ui.inventory.manageWarehouses}
          </Link>
          <button type="button" onClick={() => setModal({ kind: 'create' })} className="min-h-11 rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:bg-gold-hover">
            {MESSAGES.ui.inventory.newProduct}
          </button>
          <button type="button" onClick={() => { setSuccess(null); setModal({ kind: 'import' }) }} className="min-h-11 rounded-md border border-black px-4 py-2 text-sm font-medium text-black hover:bg-ivory-dark">
            {MESSAGES.ui.inventory.importButton}
          </button>
        </div>
      </div>

      <nav aria-label={MESSAGES.ui.inventory.title} className="overflow-x-auto rounded-lg border border-ivory-dark bg-black">
        <ul className="flex w-max min-w-full gap-4 px-3 sm:gap-6 sm:px-4">
          {warehouses.map((option) => {
            const active = option.id === warehouse.id
            return (
              <li key={option.id}>
                <Link
                  href={`/inventory?warehouse=${encodeURIComponent(option.id)}`}
                  aria-current={active ? 'page' : undefined}
                  className={`block whitespace-nowrap border-b-2 py-3 text-sm font-medium ${active ? 'border-gold text-gold' : 'border-transparent text-ivory/70 hover:text-ivory'}`}
                >
                  {option.name}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={MESSAGES.ui.inventory.search}
        className="rounded-md border border-ivory-dark bg-ivory px-3 py-2 text-sm focus:border-gold focus:outline-none"
      />

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {success && <p role="status" className="rounded-md border border-green-700/30 bg-green-50 px-3 py-2 text-sm text-green-800">{success}</p>}

      <div className="overflow-x-auto rounded-lg border border-ivory-dark bg-ivory">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-ivory-dark bg-ivory text-black/75">
            <tr>
              <th className="px-4 py-3 font-medium">{MESSAGES.ui.inventory.columns.code}</th>
              <th className="px-4 py-3 font-medium">{MESSAGES.ui.inventory.columns.name}</th>
              <th className="px-4 py-3 text-right font-medium">{MESSAGES.ui.inventory.columns.price}</th>
              <th className="px-4 py-3 text-right font-medium">{MESSAGES.ui.inventory.columns.stock}</th>
              <th className="px-4 py-3 font-medium">{MESSAGES.ui.inventory.columns.actions}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-black/60">{MESSAGES.ui.inventory.empty}</td>
              </tr>
            )}
            {filtered.map((product) => (
              <tr key={product.code} className="border-b border-ivory-dark last:border-0">
                <td className="px-4 py-3 font-mono text-black">{product.code}</td>
                <td className="px-4 py-3 text-black">{product.name}</td>
                <td className="px-4 py-3 text-right tabular-nums text-black/75">{formatCents(product.basePriceUsdCents)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-black/75">{product.stock}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setModal({ kind: 'edit', product })} className="min-h-11 rounded-md border border-ivory-dark px-3 py-2 hover:bg-ivory-dark">
                      {MESSAGES.common.edit}
                    </button>
                    <button type="button" onClick={() => setModal({ kind: 'remove', product })} className="min-h-11 rounded-md border border-red-300 px-3 py-2 text-red-700 hover:bg-red-50">
                      {MESSAGES.common.delete}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {activeModal?.kind === 'create' && (
        <Modal title={MESSAGES.ui.inventory.createTitle} onClose={close}>
          <ProductForm warehouseId={warehouse.id} product={null} onSaved={handleSaved} onCancel={close} />
        </Modal>
      )}
      {activeModal?.kind === 'edit' && (
        <Modal title={MESSAGES.ui.inventory.editTitle} onClose={close}>
          <ProductForm warehouseId={warehouse.id} product={activeModal.product} onSaved={handleSaved} onCancel={close} />
        </Modal>
      )}
      {activeModal?.kind === 'import' && (
        <Modal title={MESSAGES.ui.inventory.import.title} onClose={close} wide>
          <InventoryImportWizard warehouseId={warehouse.id} onImported={handleImported} onCancel={close} />
        </Modal>
      )}
      {activeModal?.kind === 'remove' && (
        <ConfirmDialog
          title={MESSAGES.ui.inventory.removeTitle}
          message={MESSAGES.ui.inventory.removeConfirm(activeModal.product.name, activeModal.product.stock)}
          confirmLabel={MESSAGES.common.delete}
          busy={busy}
          onConfirm={() => handleRemove(activeModal.product)}
          onCancel={close}
        />
      )}
    </div>
  )
}
