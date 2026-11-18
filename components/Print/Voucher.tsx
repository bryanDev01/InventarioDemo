import type { ReactElement } from 'react'
import './voucher.css'
import { APP_NAME, PAYMENT_METHODS } from '@/lib/constants'
import { formatDateTime } from '@/lib/dates'
import { formatCents } from '@/lib/money'
import { MESSAGES } from '@/lib/messages'
import type { InvoiceRecord } from '@/types/invoice'

interface VoucherProps {
  invoice: InvoiceRecord
  id?: string
}

const PAYMENT_LABELS: Record<InvoiceRecord['paymentMethod'], string> = {
  [PAYMENT_METHODS.CASH]: MESSAGES.pos.cash,
  [PAYMENT_METHODS.TRANSFER]: MESSAGES.pos.transfer,
}

export default function Voucher({ invoice, id = 'voucher-print-area' }: VoucherProps): ReactElement {
  const transporter = invoice.transporter
  const hasTransporter = transporter !== null && (transporter.name || transporter.ci || transporter.plate)

  return (
    <div id={id} className="vale">
      <h2 className="vale-title">VALE DE VENTA</h2>
      <div className="vale-row"><span>Nº de factura</span><span>{invoice.reference}</span></div>
      <div className="vale-row"><span>Fecha</span><span>{formatDateTime(new Date(invoice.createdAt))}</span></div>
      <div className="vale-row"><span>Vendedor</span><span>{invoice.sellerUsername}</span></div>
      <div className="vale-row"><span>Sucursal</span><span>{invoice.warehouseId}</span></div>

      <div className="vale-divider" />

      <div className="vale-row"><span>Cliente</span><span>{invoice.client.name}</span></div>
      <div className="vale-row"><span>C.I.</span><span>{invoice.client.ci}</span></div>

      {hasTransporter && transporter && (
        <div className="vale-block">
          {transporter.name && <div className="vale-row"><span>Transportista</span><span>{transporter.name}</span></div>}
          {transporter.ci && <div className="vale-row"><span>C.I.</span><span>{transporter.ci}</span></div>}
          {transporter.plate && <div className="vale-row"><span>Chapa</span><span>{transporter.plate}</span></div>}
        </div>
      )}

      <div className="vale-divider" />

      <div className="vale-row">
        <span>Tasa utilizada</span>
        <span>1 USD = {formatCents(invoice.rateCents)} CUP</span>
      </div>

      <div className="vale-divider" />

      {invoice.lines.map((line) => (
        <div key={`${line.code}-${line.name}`} className="vale-item">
          <div className="vale-row"><span>{line.code}</span></div>
          <div className="vale-name">{line.name}</div>
          <div className="vale-row">
            <span>{line.quantity} x {formatCents(line.unitPriceCupCents)}</span>
            <span>{formatCents(line.subtotalCupCents)}</span>
          </div>
        </div>
      ))}

      <div className="vale-divider" />

      <div className="vale-total">
        <div className="vale-total-label">TOTAL A PAGAR (CUP)</div>
        <div className="vale-total-amount">{formatCents(invoice.totalCupCents)}</div>
        <div className="vale-total-usd">Referencia USD: {formatCents(invoice.totalUsdCents)}</div>
        <div className="vale-total-usd">Método de pago: {PAYMENT_LABELS[invoice.paymentMethod]}</div>
      </div>

      <div className="vale-sign">
        <div className="vale-sign-line" />
        <div>{invoice.sellerUsername}</div>
        <div>Firma del vendedor</div>
        <div className="vale-sign-line" />
        <div>{invoice.client.name}</div>
        <div>Firma del comprador</div>
      </div>

      <p style={{ textAlign: 'center', marginTop: '4mm' }}>{APP_NAME}</p>
    </div>
  )
}
