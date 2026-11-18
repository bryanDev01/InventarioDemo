'use client'

import { useState } from 'react'
import type { FormEvent, ReactElement } from 'react'
import { apiRequest } from '@/lib/apiClient'
import { MESSAGES } from '@/lib/messages'
import type { CreateWarehousePayload, UpdateWarehousePayload, WarehouseRecord } from '@/types/warehouse'

interface WarehouseFormProps {
  warehouse: WarehouseRecord | null
  onSaved: () => void
  onCancel: () => void
}

export default function WarehouseForm({ warehouse, onSaved, onCancel }: WarehouseFormProps): ReactElement {
  const isEdit = warehouse !== null
  const [name, setName] = useState<string>(warehouse?.name ?? '')
  const [location, setLocation] = useState<string>(warehouse?.location ?? '')
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (loading) return
    setError(null)
    setLoading(true)
    try {
      if (isEdit && warehouse) {
        const payload: UpdateWarehousePayload = { name, location }
        await apiRequest<WarehouseRecord>(`/api/warehouses/${warehouse.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
      } else {
        const payload: CreateWarehousePayload = { name, location }
        await apiRequest<WarehouseRecord>('/api/warehouses', { method: 'POST', body: JSON.stringify(payload) })
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : MESSAGES.common.unexpectedError)
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {isEdit && warehouse && (
        <p className="text-xs text-black/60">{MESSAGES.ui.warehouses.idHelp} ID: {warehouse.id}</p>
      )}
      <label className="flex flex-col gap-1 text-sm font-medium text-black/75">
        {MESSAGES.ui.warehouses.name}
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={80}
          className="rounded-md border border-ivory-dark px-3 py-2 font-normal focus:border-gold focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-black/75">
        {MESSAGES.ui.warehouses.location}
        <input
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          maxLength={160}
          className="rounded-md border border-ivory-dark px-3 py-2 font-normal focus:border-gold focus:outline-none"
        />
      </label>
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
