'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { ReactElement } from 'react'
import ConfirmDialog from '@/components/Common/ConfirmDialog'
import Modal from '@/components/Common/Modal'
import InvoiceEditForm from '@/components/Forms/InvoiceEditForm'
import VoucherPreview from '@/components/Print/VoucherPreview'
import { apiRequest } from '@/lib/apiClient'
import { MESSAGES } from '@/lib/messages'
import type { InvoiceRecord } from '@/types/invoice'

interface InvoiceActionsProps {
  invoice: InvoiceRecord
  canManage: boolean
}

export default function InvoiceActions({ invoice, canManage }: InvoiceActionsProps): ReactElement {
  const router = useRouter()
  const [editing, setEditing] = useState<boolean>(false)
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false)
  const [voucher, setVoucher] = useState<InvoiceRecord | null>(null)
  const [busy, setBusy] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await apiRequest<never>(`/api/invoices/${invoice.reference}`, { method: 'DELETE' })
      setConfirmDelete(false)
      router.replace('/invoices')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : MESSAGES.common.unexpectedError)
    } finally {
      setBusy(false)
    }
  }

  const handleSaved = (updated: InvoiceRecord): void => {
    setEditing(false)
    setVoucher(updated)
    router.refresh()
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setVoucher(invoice)} className="min-h-11 rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:bg-gold-hover">
          {MESSAGES.invoices.detail.reprint}
        </button>
        {canManage && (
          <>
            <button type="button" onClick={() => setEditing(true)} className="min-h-11 rounded-md border border-gold px-4 py-2 text-sm text-gold hover:bg-gold hover:text-black">
              {MESSAGES.invoices.detail.edit}
            </button>
            <button type="button" onClick={() => setConfirmDelete(true)} className="min-h-11 rounded-md border border-red-400 px-4 py-2 text-sm text-red-300 hover:bg-red-900/30">
              {MESSAGES.invoices.detail.delete}
            </button>
          </>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}

      {editing && (
        <Modal title={MESSAGES.invoices.detail.editTitle} onClose={() => setEditing(false)} wide>
          <InvoiceEditForm invoice={invoice} onSaved={handleSaved} onCancel={() => setEditing(false)} />
        </Modal>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={MESSAGES.invoices.detail.deleteTitle}
          message={MESSAGES.invoices.detail.deleteConfirm(invoice.reference)}
          confirmLabel={MESSAGES.invoices.detail.delete}
          busy={busy}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}

      {voucher && (
        <VoucherPreview invoice={voucher} priceChanged={false} onClose={() => setVoucher(null)} />
      )}
    </div>
  )
}
