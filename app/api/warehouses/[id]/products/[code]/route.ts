import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { toErrorResponse } from '@/lib/errors'
import { ProductService } from '@/lib/services/ProductService'
import type { ApiResponse } from '@/types/api'
import type { UpdateInventoryPayload } from '@/types/product'

interface RouteContext {
  params: Promise<{ id: string; code: string }>
}

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse<ApiResponse<never>>> {
  try {
    const actor = await requireUser()
    const { id, code } = await context.params
    const payload = (await request.json()) as UpdateInventoryPayload
    await ProductService.update(actor, id, decodeURIComponent(code), payload)
    return NextResponse.json({ success: true, timestamp: new Date().toISOString() })
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function DELETE(_request: Request, context: RouteContext): Promise<NextResponse<ApiResponse<never>>> {
  try {
    await requireUser()
    const { id, code } = await context.params
    await ProductService.removeFromInventory(id, decodeURIComponent(code))
    return NextResponse.json({ success: true, timestamp: new Date().toISOString() })
  } catch (error) {
    return toErrorResponse(error)
  }
}
