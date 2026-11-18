'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { ReactElement } from 'react'
import ConfirmDialog from '@/components/Common/ConfirmDialog'
import { apiRequest } from '@/lib/apiClient'
import { MESSAGES } from '@/lib/messages'

interface PermanentDeleteButtonProps {
  reference: string
}

export default function PermanentDeleteButton({ reference }: PermanentDeleteButtonProps): ReactElement {
  const router = useRouter()
  const [confirming, setConfirming] = useState<boolean>(false)
  const [busy, setBusy] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const handlePurge = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await apiRequest<never>(`/api/invoices/${reference}/purge`, { method: 'DELETE' })
      setConfirming(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : MESSAGES.common.unexpectedError)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-md border border-red-400 px-3 py-1 font-medium text-red-700 hover:bg-red-50"
      >
        {MESSAGES.invoices.detail.purge}
      </button>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
      {confirming && (
        <ConfirmDialog
          title={MESSAGES.invoices.detail.purgeTitle}
          message={MESSAGES.invoices.detail.purgeConfirm(reference)}
          confirmLabel={MESSAGES.invoices.detail.purge}
          busy={busy}
          onConfirm={handlePurge}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  )
}
