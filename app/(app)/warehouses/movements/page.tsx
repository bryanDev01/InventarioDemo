import { Suspense } from 'react'
import type { ReactElement } from 'react'
import MovementsContent from '@/components/Movements/MovementsContent'

interface StockMovementsPageProps {
  searchParams: Promise<Record<string, string | undefined>>
}

export default function StockMovementsPage({ searchParams }: StockMovementsPageProps): ReactElement {
  return (
    <Suspense fallback={<div className="min-h-[40vh] rounded-lg bg-ivory/20" />}>
      <MovementsContent searchParams={searchParams} />
    </Suspense>
  )
}
