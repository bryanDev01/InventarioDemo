import { NextResponse } from 'next/server'
import { toErrorResponse } from '@/lib/errors'
import { WarehouseService } from '@/lib/services/WarehouseService'
import type { ApiResponse } from '@/types/api'
import type { UpdateWarehouseStaffPayload } from '@/types/warehouse'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PUT(request: Request, context: RouteContext): Promise<NextResponse<ApiResponse<never>>> {
  try {
    const { id } = await context.params
    const payload = (await request.json()) as UpdateWarehouseStaffPayload
    await WarehouseService.setStaff(id, payload)
    return NextResponse.json({ success: true, timestamp: new Date().toISOString() })
  } catch (error) {
    return toErrorResponse(error)
  }
}
