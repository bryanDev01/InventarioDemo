import type { ReactElement } from 'react'
import AccessDenied from '@/components/Common/AccessDenied'
import MovementsHistory from '@/components/Movements/MovementsHistory'
import { requireUser } from '@/lib/auth'
import { AppError } from '@/lib/errors'
import { ROLES } from '@/lib/constants'
import { StockMovementService } from '@/lib/services/StockMovementService'
import { WarehouseService } from '@/lib/services/WarehouseService'
import type { StockMovementListResult } from '@/types/stockMovement'
import type { WarehouseOption } from '@/types/warehouse'

interface MovementsContentProps {
  searchParams: Promise<Record<string, string | undefined>>
}

export default async function MovementsContent({ searchParams }: MovementsContentProps): Promise<ReactElement> {
  const user = await requireUser()
  if (user.role !== ROLES.ADMIN) return <AccessDenied />

  const params = await searchParams

  let result: StockMovementListResult | null = null
  let errorMessage: string | null = null
  try {
    result = await StockMovementService.list(user, params)
  } catch (error) {
    if (error instanceof AppError) errorMessage = error.message
    else throw error
  }

  const warehouses: WarehouseOption[] = await WarehouseService.listOptions()

  return <MovementsHistory result={result} warehouses={warehouses} params={params} errorMessage={errorMessage} />
}
