import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { toErrorResponse } from '@/lib/errors'
import { PosService } from '@/lib/services/PosService'
import type { ApiResponse } from '@/types/api'
import type { PosCatalog } from '@/types/pos'

export async function GET(request: Request): Promise<NextResponse<ApiResponse<PosCatalog>>> {
  try {
    const actor = await requireUser()
    const warehouseId = new URL(request.url).searchParams.get('warehouseId')
    const data = await PosService.catalog(actor, warehouseId)
    return NextResponse.json({ success: true, data, timestamp: new Date().toISOString() })
  } catch (error) {
    return toErrorResponse(error)
  }
}
