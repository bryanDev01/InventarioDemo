'use client'

import { useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import type { ReactElement } from 'react'
import Modal from '@/components/Common/Modal'
import Voucher from '@/components/Print/Voucher'
import { MESSAGES } from '@/lib/messages'
import type { InvoiceRecord } from '@/types/invoice'

interface VoucherPreviewProps {
  invoice: InvoiceRecord
  priceChanged: boolean
  onClose: () => void
}

const subscribeToNothing = (): (() => void) => () => undefined
const getMountedSnapshot = (): boolean => true
const getServerSnapshot = (): boolean => false

export default function VoucherPreview({ invoice, priceChanged, onClose }: VoucherPreviewProps): ReactElement {
  const mounted = useSyncExternalStore(subscribeToNothing, getMountedSnapshot, getServerSnapshot)

  return (
    <>
      <Modal title={MESSAGES.pos.voucherTitle} onClose={onClose}>
        <div className="flex flex-col gap-4">
          {priceChanged && <p role="alert" className="text-sm text-amber-700 no-print">{MESSAGES.pos.priceChanged}</p>}
          <p className="text-sm text-black/75 no-print">{MESSAGES.pos.printHint}</p>
          <p className="text-sm text-black/75 no-print">{MESSAGES.pos.printHelp}</p>
          <div className="max-h-[55vh] overflow-y-auto rounded-md border border-ivory-dark bg-white">
            <Voucher invoice={invoice} id="voucher-preview" />
          </div>
          <div className="no-print flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <button type="button" onClick={() => window.print()} className="min-h-11 w-full rounded-md border border-black px-4 py-2 text-sm text-black hover:bg-ivory-dark sm:w-auto">
              {MESSAGES.pos.printVoucher}
            </button>
            <button type="button" onClick={onClose} className="min-h-11 w-full rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:bg-gold-hover sm:w-auto">
              {MESSAGES.pos.newInvoice}
            </button>
          </div>
        </div>
      </Modal>

      {mounted &&
        createPortal(<Voucher invoice={invoice} id="voucher-print-area" />, document.body)}
    </>
  )
}
