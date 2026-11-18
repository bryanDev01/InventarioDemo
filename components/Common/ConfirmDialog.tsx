'use client'

import type { ReactElement } from 'react'
import Modal from '@/components/Common/Modal'
import { MESSAGES } from '@/lib/messages'

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel: string
  busy: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({ title, message, confirmLabel, busy, onConfirm, onCancel }: ConfirmDialogProps): ReactElement {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="mb-6 text-sm text-black/75">{message}</p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
        <button type="button" onClick={onCancel} disabled={busy} className="min-h-11 w-full rounded-md border border-ivory-dark px-4 py-2 text-sm hover:bg-ivory-dark disabled:opacity-50 sm:w-auto">
          {MESSAGES.common.cancel}
        </button>
        <button type="button" onClick={onConfirm} disabled={busy} className="min-h-11 w-full rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50 sm:w-auto">
          {busy ? MESSAGES.common.saving : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
