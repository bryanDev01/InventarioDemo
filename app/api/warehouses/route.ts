import { NextResponse } from 'next/server'
import { toErrorResponse } from '@/lib/errors'
import { WarehouseService } from '@/lib/services/WarehouseService'
import type { ApiResponse } from '@/types/api'
import type { CreateWarehousePayload, WarehouseRecord } from '@/types/warehouse'

export async function GET(): Promise<NextResponse<ApiResponse<WarehouseRecord[]>>> {
  try {
    const data = await WarehouseService.list()
    return NextResponse.json({ success: true, data, timestamp: new Date().toISOString() })
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function POST(request: Request): Promise<NextResponse<ApiResponse<WarehouseRecord>>> {
  try {
    const payload = (await request.json()) as CreateWarehousePayload
    const data = await WarehouseService.create(payload)
    return NextResponse.json({ success: true, data, timestamp: new Date().toISOString() }, { status: 201 })
  } catch (error) {
    return toErrorResponse(error)
  }
}
