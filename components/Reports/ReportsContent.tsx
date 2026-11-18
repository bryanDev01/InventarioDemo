import type { ReactElement } from 'react'
import SoldProductsReport from '@/components/Reports/SoldProductsReport'
import { requireUser } from '@/lib/auth'

interface ReportsContentProps {
  searchParams: Promise<Record<string, string | undefined>>
}

export default async function ReportsContent({ searchParams }: ReportsContentProps): Promise<ReactElement> {
  const params = await searchParams
  const actor = await requireUser()
  return (
    <SoldProductsReport
      actor={actor}
      filters={{
        from: params.from,
        to: params.to,
        warehouseId: params.warehouseId,
      }}
    />
  )
}
