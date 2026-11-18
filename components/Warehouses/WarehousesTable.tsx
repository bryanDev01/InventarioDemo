'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { ReactElement } from 'react'
import ConfirmDialog from '@/components/Common/ConfirmDialog'
import Modal from '@/components/Common/Modal'
import WarehouseForm from '@/components/Forms/WarehouseForm'
import WarehouseStaffForm from '@/components/Forms/WarehouseStaffForm'
import { apiRequest } from '@/lib/apiClient'
import { MESSAGES } from '@/lib/messages'
import type { WarehouseRecord, WarehouseStaff } from '@/types/warehouse'

interface WarehousesTableProps {
  warehouses: WarehouseRecord[]
  staffCandidates: WarehouseStaff[]
}

type ModalState =
  | { kind: 'create' }
  | { kind: 'edit'; warehouse: WarehouseRecord }
  | { kind: 'staff'; warehouse: WarehouseRecord }
  | { kind: 'archive'; warehouse: WarehouseRecord }
  | null

export default function WarehousesTable({ warehouses, staffCandidates }: WarehousesTableProps): ReactElement {
  const router = useRouter()
  const [modal, setModal] = useState<ModalState>(null)
  const [busy, setBusy] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const close = (): void => setModal(null)

  const handleSaved = (): void => {
    close()
    router.refresh()
  }

  const handleArchive = async (warehouse: WarehouseRecord): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await apiRequest<never>(`/api/warehouses/${warehouse.id}`, { method: 'DELETE' })
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-black sm:text-2xl">{MESSAGES.ui.warehouses.title}</h1>
        <button type="button" onClick={() => setModal({ kind: 'create' })} className="min-h-11 w-full rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:bg-gold-hover sm:w-auto">
          {MESSAGES.ui.warehouses.newWarehouse}
        </button>
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-ivory-dark bg-ivory">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-ivory-dark bg-ivory text-black/75">
            <tr>
              <th className="px-4 py-3 font-medium">{MESSAGES.ui.warehouses.columns.id}</th>
              <th className="px-4 py-3 font-medium">{MESSAGES.ui.warehouses.columns.name}</th>
              <th className="px-4 py-3 font-medium">{MESSAGES.ui.warehouses.columns.location}</th>
              <th className="px-4 py-3 text-right font-medium">{MESSAGES.ui.inventory.columns.stock}</th>
              <th className="px-4 py-3 font-medium">{MESSAGES.ui.warehouses.columns.staff}</th>
              <th className="px-4 py-3 font-medium">{MESSAGES.ui.warehouses.columns.actions}</th>
            </tr>
          </thead>
          <tbody>
            {warehouses.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-black/60">{MESSAGES.ui.warehouses.empty}</td>
              </tr>
            )}
            {warehouses.map((warehouse) => (
              <tr key={warehouse.id} className="border-b border-ivory-dark last:border-0">
                <td className="px-4 py-3 font-mono text-black">{warehouse.id}</td>
                <td className="px-4 py-3 font-medium">
                  <Link href={`/inventory?warehouse=${encodeURIComponent(warehouse.id)}`} className="text-black underline-offset-2 hover:underline">
                    {warehouse.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-black/75">{warehouse.location ?? '—'}</td>
                <td className="px-4 py-3 text-right tabular-nums text-black/75">{warehouse.totalStock}</td>
                <td className="px-4 py-3 text-black/75">
                  {warehouse.staff.length > 0 ? warehouse.staff.map((member) => member.username).join(', ') : MESSAGES.ui.warehouses.noStaff}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/inventory?warehouse=${encodeURIComponent(warehouse.id)}`} className="inline-flex min-h-11 items-center rounded-md bg-gold px-3 py-2 font-medium text-black hover:bg-gold-hover">
                      {MESSAGES.ui.inventory.title}
                    </Link>
                    <Link href={`/inventory?warehouse=${encodeURIComponent(warehouse.id)}&import=1`} className="inline-flex min-h-11 items-center rounded-md border border-gold px-3 py-2 font-medium text-black hover:bg-ivory-dark">
                      {MESSAGES.ui.warehouses.importInventory}
                    </Link>
                    <button type="button" onClick={() => setModal({ kind: 'edit', warehouse })} className="min-h-11 rounded-md border border-ivory-dark px-3 py-2 hover:bg-ivory-dark">
                      {MESSAGES.common.edit}
                    </button>
                    <button type="button" onClick={() => setModal({ kind: 'staff', warehouse })} className="min-h-11 rounded-md border border-ivory-dark px-3 py-2 hover:bg-ivory-dark">
                      {MESSAGES.ui.warehouses.staffButton}
                    </button>
                    <button type="button" onClick={() => setModal({ kind: 'archive', warehouse })} className="min-h-11 rounded-md border border-red-300 px-3 py-2 text-red-700 hover:bg-red-50">
                      {MESSAGES.ui.warehouses.archive}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal?.kind === 'create' && (
        <Modal title={MESSAGES.ui.warehouses.createTitle} onClose={close}>
          <WarehouseForm warehouse={null} onSaved={handleSaved} onCancel={close} />
        </Modal>
      )}
      {modal?.kind === 'edit' && (
        <Modal title={MESSAGES.ui.warehouses.editTitle} onClose={close}>
          <WarehouseForm warehouse={modal.warehouse} onSaved={handleSaved} onCancel={close} />
        </Modal>
      )}
      {modal?.kind === 'staff' && (
        <Modal title={MESSAGES.ui.warehouses.staffTitle} onClose={close}>
          <WarehouseStaffForm warehouse={modal.warehouse} candidates={staffCandidates} onSaved={handleSaved} onCancel={close} />
        </Modal>
      )}
      {modal?.kind === 'archive' && (
        <ConfirmDialog
          title={MESSAGES.ui.warehouses.archiveTitle}
          message={MESSAGES.warehouses.archiveConfirm(modal.warehouse.name, modal.warehouse.productCount, modal.warehouse.totalStock)}
          confirmLabel={MESSAGES.ui.warehouses.archive}
          busy={busy}
          onConfirm={() => handleArchive(modal.warehouse)}
          onCancel={close}
        />
      )}
    </div>
  )
}
