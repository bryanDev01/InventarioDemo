'use client'

import { useState } from 'react'
import type { FormEvent, ReactElement } from 'react'
import { apiRequest } from '@/lib/apiClient'
import { PAYMENT_METHODS } from '@/lib/constants'
import type { PaymentMethod } from '@/lib/constants'
import { MESSAGES } from '@/lib/messages'
import type { InvoiceRecord, UpdateInvoicePayload } from '@/types/invoice'

interface InvoiceEditFormProps {
  invoice: InvoiceRecord
  onSaved: (updated: InvoiceRecord) => void
  onCancel: () => void
}

export default function InvoiceEditForm({ invoice, onSaved, onCancel }: InvoiceEditFormProps): ReactElement {
  const [quantities, setQuantities] = useState<Record<string, string>>(
    Object.fromEntries(invoice.lines.map((line) => [line.code, String(line.quantity)]))
  )
  const [clientName, setClientName] = useState<string>(invoice.client.name)
  const [clientCi, setClientCi] = useState<string>(invoice.client.ci)
  const [transporterName, setTransporterName] = useState<string>(invoice.transporter?.name ?? '')
  const [transporterCi, setTransporterCi] = useState<string>(invoice.transporter?.ci ?? '')
  const [vehiclePlate, setVehiclePlate] = useState<string>(invoice.transporter?.plate ?? '')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>(invoice.paymentMethod)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (loading) return
    setError(null)
    setLoading(true)
    try {
      const payload: UpdateInvoicePayload = {
        lines: invoice.lines.map((line) => ({ code: line.code, quantity: quantities[line.code] ?? '' })),
        clientName,
        clientCi,
        transporterName,
        transporterCi,
        vehiclePlate: vehiclePlate.toUpperCase(),
        paymentMethod,
      }
      const updated = await apiRequest<InvoiceRecord>(`/api/invoices/${invoice.reference}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      if (!updated) throw new Error(MESSAGES.common.unexpectedError)
      onSaved(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : MESSAGES.common.unexpectedError)
      setLoading(false)
    }
  }

  const inputClass = 'rounded-md border border-ivory-dark bg-ivory px-3 py-2 font-normal text-black focus:border-gold focus:outline-none'

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-sm text-black/75">{MESSAGES.invoices.detail.editHelp}</p>

      <div className="flex flex-col gap-2">
        {invoice.lines.map((line) => (
          <label key={line.code} className="flex items-center justify-between gap-3 text-sm text-black">
            <span className="min-w-0 flex-1">{line.name} <span className="font-mono text-xs text-black/60">{line.code}</span></span>
            <span className="flex items-center gap-2">
              <span className="text-xs text-black/60">{MESSAGES.invoices.detail.quantity}</span>
              <input
                value={quantities[line.code] ?? ''}
                onChange={(event) => setQuantities((current) => ({ ...current, [line.code]: event.target.value }))}
                inputMode="numeric"
                className={`w-20 text-right ${inputClass}`}
              />
            </span>
          </label>
        ))}
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium text-black">
        {MESSAGES.pos.clientName}
        <input value={clientName} onChange={(event) => setClientName(event.target.value)} maxLength={120} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-black">
        {MESSAGES.pos.clientCi}
        <input value={clientCi} onChange={(event) => setClientCi(event.target.value.replace(/\D/g, ''))} inputMode="numeric" maxLength={11} className={inputClass} />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-black">
          {MESSAGES.pos.transporterName}
          <input value={transporterName} onChange={(event) => setTransporterName(event.target.value)} maxLength={120} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-black">
          {MESSAGES.pos.transporterCi}
          <input value={transporterCi} onChange={(event) => setTransporterCi(event.target.value.replace(/\D/g, ''))} inputMode="numeric" maxLength={11} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-black">
          {MESSAGES.pos.plate}
          <input value={vehiclePlate} onChange={(event) => setVehiclePlate(event.target.value.toUpperCase())} maxLength={7} className={`font-mono ${inputClass}`} />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm font-medium text-black">
        {MESSAGES.pos.paymentMethod}
        <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)} className={inputClass}>
          <option value={PAYMENT_METHODS.CASH}>{MESSAGES.pos.cash}</option>
          <option value={PAYMENT_METHODS.TRANSFER}>{MESSAGES.pos.transfer}</option>
        </select>
      </label>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
        <button type="button" onClick={onCancel} disabled={loading} className="min-h-11 w-full rounded-md border border-black px-4 py-2 text-sm text-black hover:bg-ivory-dark disabled:opacity-50 sm:w-auto">
          {MESSAGES.common.cancel}
        </button>
        <button type="submit" disabled={loading} className="min-h-11 w-full rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:bg-gold-hover disabled:opacity-50 sm:w-auto">
          {loading ? MESSAGES.common.saving : MESSAGES.common.save}
        </button>
      </div>
    </form>
  )
}
