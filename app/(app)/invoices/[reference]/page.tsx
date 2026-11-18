import { Suspense } from 'react'
import type { ReactElement } from 'react'
import InvoiceDetailContent from '@/components/Invoices/InvoiceDetailContent'

interface InvoiceDetailPageProps {
  params: Promise<{ reference: string }>
}

export default async function InvoiceDetailPage({ params }: InvoiceDetailPageProps): Promise<ReactElement> {
  const { reference } = await params
  return (
    <Suspense fallback={<div className="min-h-[40vh] rounded-lg bg-ivory/20" />}>
      <InvoiceDetailContent reference={reference} />
    </Suspense>
  )
}
