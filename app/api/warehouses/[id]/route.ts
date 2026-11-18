import { NextResponse } from 'next/server'
import { toErrorResponse } from '@/lib/errors'
import { WarehouseService } from '@/lib/services/WarehouseService'
import type { ApiResponse } from '@/types/api'
import type { UpdateWarehousePayload, WarehouseRecord } from '@/types/warehouse'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse<ApiResponse<WarehouseRecord>>> {
  try {
    const { id } = await context.params
    const payload = (await request.json()) as UpdateWarehousePayload
    const data = await WarehouseService.update(id, payload)
    return NextResponse.json({ success: true, data, timestamp: new Date().toISOString() })
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function DELETE(_request: Request, context: RouteContext): Promise<NextResponse<ApiResponse<never>>> {
  try {
    const { id } = await context.params
    await WarehouseService.archive(id)
    return NextResponse.json({ success: true, timestamp: new Date().toISOString() })
  } catch (error) {
    return toErrorResponse(error)
  }
}
