import { Suspense } from 'react'
import type { ReactElement } from 'react'
import InvoicesContent from '@/components/Invoices/InvoicesContent'

interface InvoicesPageProps {
  searchParams: Promise<Record<string, string | undefined>>
}

export default function InvoicesPage({ searchParams }: InvoicesPageProps): ReactElement {
  return (
    <Suspense fallback={<div className="min-h-[40vh] rounded-lg bg-ivory/20" />}>
      <InvoicesContent searchParams={searchParams} />
    </Suspense>
  )
}
