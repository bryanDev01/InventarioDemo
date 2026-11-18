import { NextResponse } from 'next/server'
import { toErrorResponse } from '@/lib/errors'
import { ProductImportService } from '@/lib/services/ProductImportService'
import type { ApiResponse } from '@/types/api'
import type { InventoryImportResult } from '@/types/inventoryImport'

interface RouteContext {
  params: Promise<{ id: string }>
}

interface ImportPayload {
  rows?: unknown
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse<ApiResponse<InventoryImportResult>>> {
  try {
    const { id } = await context.params
    const payload = (await request.json()) as ImportPayload
    const data = await ProductImportService.import(id, payload.rows)
    return NextResponse.json({ success: true, data, timestamp: new Date().toISOString() })
  } catch (error) {
    return toErrorResponse(error)
  }
}
