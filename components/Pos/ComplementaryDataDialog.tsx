'use client'

import { useState } from 'react'
import type { FormEvent, ReactElement } from 'react'
import Modal from '@/components/Common/Modal'
import { PAYMENT_METHODS } from '@/lib/constants'
import type { PaymentMethod } from '@/lib/constants'
import { formatCents } from '@/lib/money'
import { MESSAGES } from '@/lib/messages'

export interface ComplementaryData {
  requestId: string
  transporterName: string
  transporterCi: string
  vehiclePlate: string
  paymentMethod: PaymentMethod | ''
}

interface ComplementaryDataDialogProps {
  totalCupCents: number
  totalUsdCents: number
  onSubmit: (data: ComplementaryData) => Promise<string | null>
  onCancel: () => void
}

export default function ComplementaryDataDialog({ totalCupCents, totalUsdCents, onSubmit, onCancel }: ComplementaryDataDialogProps): ReactElement {
  const [requestId] = useState<string>(() => crypto.randomUUID())
  const [transporterName, setTransporterName] = useState<string>('')
  const [transporterCi, setTransporterCi] = useState<string>('')
  const [vehiclePlate, setVehiclePlate] = useState<string>('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (loading) return
    setError(null)
    if (paymentMethod === '') {
      setError(MESSAGES.invoices.invalidPayment)
      return
    }
    setLoading(true)
    const result = await onSubmit({
      requestId,
      transporterName,
      transporterCi,
      vehiclePlate: vehiclePlate.toUpperCase(),
      paymentMethod,
    })
    if (result !== null) {
      setError(result)
      setLoading(false)
    }
  }

  return (
    <Modal title={MESSAGES.pos.dialogTitle} onClose={loading ? () => undefined : onCancel}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid gap-3 rounded-md bg-ivory-dark p-3 text-sm text-black min-[380px]:grid-cols-2">
          <div>
            <p className="text-black/70">{MESSAGES.pos.importeCup}</p>
            <p className="font-semibold tabular-nums">{formatCents(totalCupCents)}</p>
          </div>
          <div>
            <p className="text-black/70">{MESSAGES.pos.importeUsd}</p>
            <p className="font-semibold tabular-nums">{formatCents(totalUsdCents)}</p>
          </div>
        </div>

        <label className="flex flex-col gap-1 text-sm font-medium text-black">
          {MESSAGES.pos.transporterName} <span className="font-normal text-black/60">({MESSAGES.pos.optional})</span>
          <input value={transporterName} onChange={(event) => setTransporterName(event.target.value)} maxLength={120} className="rounded-md border border-ivory-dark bg-ivory px-3 py-2 font-normal text-black focus:border-gold focus:outline-none" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-black">
          {MESSAGES.pos.transporterCi}
          <input value={transporterCi} onChange={(event) => setTransporterCi(event.target.value)} inputMode="numeric" maxLength={11} className="rounded-md border border-ivory-dark bg-ivory px-3 py-2 font-normal text-black focus:border-gold focus:outline-none" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-black">
          {MESSAGES.pos.plate}
          <input value={vehiclePlate} onChange={(event) => setVehiclePlate(event.target.value.toUpperCase())} maxLength={7} className="rounded-md border border-ivory-dark bg-ivory px-3 py-2 font-mono font-normal text-black focus:border-gold focus:outline-none" />
        </label>

        <fieldset className="flex flex-col gap-2 text-sm text-black">
          <legend className="mb-1 font-medium">{MESSAGES.pos.paymentMethod}</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="payment" checked={paymentMethod === PAYMENT_METHODS.CASH} onChange={() => setPaymentMethod(PAYMENT_METHODS.CASH)} />
            {MESSAGES.pos.cash}
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="payment" checked={paymentMethod === PAYMENT_METHODS.TRANSFER} onChange={() => setPaymentMethod(PAYMENT_METHODS.TRANSFER)} />
            {MESSAGES.pos.transfer}
          </label>
        </fieldset>

        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <button type="button" onClick={onCancel} disabled={loading} className="w-full rounded-md border border-black px-4 py-2 text-sm text-black hover:bg-ivory-dark disabled:opacity-50 sm:w-auto">
            {MESSAGES.pos.cancel}
          </button>
          <button type="submit" disabled={loading} className="w-full rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:bg-gold-hover disabled:opacity-50 sm:w-auto">
            {loading ? MESSAGES.pos.processing : MESSAGES.pos.processPrint}
          </button>
        </div>
      </form>
    </Modal>
  )
}
