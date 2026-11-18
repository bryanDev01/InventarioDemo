import { NextResponse } from 'next/server'
import { toErrorResponse } from '@/lib/errors'
import { ProductImportService } from '@/lib/services/ProductImportService'
import type { ApiResponse } from '@/types/api'
import type { InventoryImportPreview } from '@/types/inventoryImport'

interface RouteContext {
  params: Promise<{ id: string }>
}

interface PreviewPayload {
  rows?: unknown
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse<ApiResponse<InventoryImportPreview>>> {
  try {
    const { id } = await context.params
    const payload = (await request.json()) as PreviewPayload
    const data = await ProductImportService.preview(id, payload.rows)
    return NextResponse.json({ success: true, data, timestamp: new Date().toISOString() })
  } catch (error) {
    return toErrorResponse(error)
  }
}
