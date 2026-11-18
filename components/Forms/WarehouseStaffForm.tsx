'use client'

import { useState } from 'react'
import type { FormEvent, ReactElement } from 'react'
import { apiRequest } from '@/lib/apiClient'
import { MESSAGES } from '@/lib/messages'
import type { UpdateWarehouseStaffPayload, WarehouseRecord, WarehouseStaff } from '@/types/warehouse'

interface WarehouseStaffFormProps {
  warehouse: WarehouseRecord
  candidates: WarehouseStaff[]
  onSaved: () => void
  onCancel: () => void
}

export default function WarehouseStaffForm({ warehouse, candidates, onSaved, onCancel }: WarehouseStaffFormProps): ReactElement {
  const [userIds, setUserIds] = useState<string[]>(warehouse.staff.map((member) => member.id))
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const toggleUser = (id: string): void => {
    setUserIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (loading) return
    setError(null)
    setLoading(true)
    try {
      const payload: UpdateWarehouseStaffPayload = { userIds }
      await apiRequest<never>(`/api/warehouses/${warehouse.id}/staff`, { method: 'PUT', body: JSON.stringify(payload) })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : MESSAGES.common.unexpectedError)
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-sm text-black/75">{MESSAGES.ui.warehouses.staffHelp}</p>
      <fieldset className="flex flex-col gap-2 text-sm text-black">
        {candidates.length === 0 && <span className="text-xs text-black/60">{MESSAGES.ui.warehouses.staffEmpty}</span>}
        {candidates.map((candidate) => (
          <label key={candidate.id} className="flex items-center gap-2">
            <input type="checkbox" checked={userIds.includes(candidate.id)} onChange={() => toggleUser(candidate.id)} />
            {candidate.username}
          </label>
        ))}
      </fieldset>
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
