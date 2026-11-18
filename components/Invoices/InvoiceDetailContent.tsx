import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { ReactElement } from 'react'
import AccessDenied from '@/components/Common/AccessDenied'
import InvoiceActions from '@/components/Invoices/InvoiceActions'
import { requireUser } from '@/lib/auth'
import { formatDateTime } from '@/lib/dates'
import { AppError } from '@/lib/errors'
import { formatCents } from '@/lib/money'
import { MESSAGES } from '@/lib/messages'
import { InvoiceService } from '@/lib/services/InvoiceService'
import type { AuthUser } from '@/types/user'
import type { InvoiceAuditRecord, InvoiceRecord } from '@/types/invoice'

interface InvoiceDetailContentProps {
  reference: string
}

const D = MESSAGES.invoices.detail

const loadInvoice = async (
  actor: AuthUser,
  reference: string
): Promise<{ invoice: InvoiceRecord; audits: InvoiceAuditRecord[]; canManage: boolean } | 'forbidden'> => {
  try {
    return await InvoiceService.get(actor, reference)
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound()
    if (error instanceof AppError && error.status === 403) return 'forbidden'
    throw error
  }
}

export default async function InvoiceDetailContent({ reference }: InvoiceDetailContentProps): Promise<ReactElement> {
  const actor = await requireUser()
  const loaded = await loadInvoice(actor, reference)
  if (loaded === 'forbidden') return <AccessDenied />

  const { invoice, audits, canManage } = loaded
  const isDeleted = invoice.status === 'deleted'
  const transporterFilled = invoice.transporter !== null && (invoice.transporter.name || invoice.transporter.ci || invoice.transporter.plate)

  return (
    <div className="flex flex-col gap-6">
      <Link href={isDeleted ? '/invoices?view=deleted' : '/invoices'} className="text-sm text-ivory/80 hover:text-gold">← {D.back}</Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-mono text-2xl font-semibold text-gold">{invoice.reference}</h1>
          <p className="text-sm text-ivory/80">{D.statusLabels[invoice.status]}</p>
        </div>
        <InvoiceActions invoice={invoice} canManage={canManage} />
      </div>

      {isDeleted && <p role="status" className="rounded-md bg-ivory p-3 text-sm text-red-700">{D.readOnly}</p>}

      <section className="grid gap-4 rounded-lg bg-ivory p-5 text-sm text-black sm:grid-cols-2">
        <div><p className="text-black/70">{D.date}</p><p>{formatDateTime(new Date(invoice.createdAt))}</p></div>
        <div><p className="text-black/70">{D.seller}</p><p>{invoice.sellerUsername}</p></div>
        <div><p className="text-black/70">{D.warehouse}</p><p>{invoice.warehouseName} ({invoice.warehouseId})</p></div>
        <div><p className="text-black/70">{D.rate}</p><p className="tabular-nums">1 USD = {formatCents(invoice.rateCents)} CUP</p></div>
        <div><p className="text-black/70">{D.client}</p><p>{invoice.client.name} · {invoice.client.ci}</p></div>
        <div><p className="text-black/70">{D.payment}</p><p>{invoice.paymentMethod === 'cash' ? MESSAGES.pos.cash : MESSAGES.pos.transfer}</p></div>
        {transporterFilled && invoice.transporter && (
          <div className="sm:col-span-2">
            <p className="text-black/70">{D.transporter}</p>
            <p>{[invoice.transporter.name, invoice.transporter.ci, invoice.transporter.plate].filter(Boolean).join(' · ')}</p>
          </div>
        )}
      </section>

      <section className="overflow-x-auto rounded-lg bg-ivory">
        <h2 className="px-4 pt-4 text-lg font-semibold text-black">{D.lines}</h2>
        <table className="mt-2 min-w-full text-left text-sm text-black">
          <thead className="border-b border-ivory-dark bg-ivory-dark">
            <tr>
              <th className="px-3 py-2 font-medium">{MESSAGES.pos.columns.product}</th>
              <th className="px-3 py-2 text-right font-medium">{MESSAGES.pos.columns.qty}</th>
              <th className="px-3 py-2 text-right font-medium">{MESSAGES.pos.columns.price}</th>
              <th className="px-3 py-2 text-right font-medium">{MESSAGES.pos.columns.subtotal}</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => (
              <tr key={line.code} className="border-b border-ivory-dark last:border-0">
                <td className="px-3 py-2"><p>{line.name}</p><p className="font-mono text-xs text-black/60">{line.code}</p></td>
                <td className="px-3 py-2 text-right tabular-nums">{line.quantity}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCents(line.unitPriceCupCents)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCents(line.subtotalCupCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex flex-col items-end gap-1 p-4 text-black">
          <p className="text-lg font-semibold tabular-nums">{D.totals}: {formatCents(invoice.totalCupCents)} CUP</p>
          <p className="tabular-nums text-black/75">{formatCents(invoice.totalUsdCents)} USD</p>
        </div>
      </section>

      <section className="rounded-lg bg-ivory p-5 text-sm text-black">
        <h2 className="mb-3 text-lg font-semibold">{D.audit}</h2>
        {audits.length === 0 && <p className="text-black/60">{D.noAudit}</p>}
        <ul className="flex flex-col gap-2">
          {audits.map((audit, index) => (
            <li key={`${audit.createdAt}-${index}`} className="border-b border-ivory-dark pb-2 last:border-0">
              <span className="font-medium">{D.auditLabels[audit.action as 'modified' | 'deleted'] ?? audit.action}</span>
              {' · '}{audit.username}{' · '}{formatDateTime(new Date(audit.createdAt))}
              <p className="text-black/70">{audit.detail}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
