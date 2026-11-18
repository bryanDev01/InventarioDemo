import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { toErrorResponse } from '@/lib/errors'
import { StockMovementService } from '@/lib/services/StockMovementService'
import type { ApiResponse } from '@/types/api'
import type { CreateStockMovementPayload } from '@/types/stockMovement'

export async function POST(request: Request): Promise<NextResponse<ApiResponse<never>>> {
  try {
    const actor = await requireUser()
    const payload = (await request.json()) as CreateStockMovementPayload
    await StockMovementService.create(actor, payload)
    return NextResponse.json({ success: true, timestamp: new Date().toISOString() }, { status: 201 })
  } catch (error) {
    return toErrorResponse(error)
  }
}
