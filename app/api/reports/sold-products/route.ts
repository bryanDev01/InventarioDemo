import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { toErrorResponse } from '@/lib/errors'
import { ReportService } from '@/lib/services/ReportService'
import type { ApiResponse } from '@/types/api'
import type { SoldProductsReport } from '@/lib/services/ReportService'

export async function GET(request: Request): Promise<NextResponse<ApiResponse<SoldProductsReport>>> {
  try {
    const actor = await requireUser()
    const params = new URL(request.url).searchParams
    const data = await ReportService.build(actor, {
      from: params.get('from') ?? undefined,
      to: params.get('to') ?? undefined,
      warehouseId: params.get('warehouseId') ?? undefined,
    })
    return NextResponse.json({ success: true, data, timestamp: new Date().toISOString() })
  } catch (error) {
    return toErrorResponse(error)
  }
}
