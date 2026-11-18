import { Suspense } from 'react'
import type { ReactElement } from 'react'
import ReportsContent from '@/components/Reports/ReportsContent'

interface ReportsPageProps {
  searchParams: Promise<Record<string, string | undefined>>
}

export default function ReportsPage({ searchParams }: ReportsPageProps): ReactElement {
  return (
    <Suspense fallback={<div className="min-h-[40vh] rounded-lg bg-ivory/20" />}>
      <ReportsContent searchParams={searchParams} />
    </Suspense>
  )
}
