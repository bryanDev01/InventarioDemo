import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { toErrorResponse } from '@/lib/errors'
import { ProductService } from '@/lib/services/ProductService'
import type { ApiResponse } from '@/types/api'
import type { ProductRecord, RegisterProductPayload } from '@/types/product'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse<ApiResponse<ProductRecord[]>>> {
  try {
    const { id } = await context.params
    const data = await ProductService.listInventory(id)
    return NextResponse.json({ success: true, data, timestamp: new Date().toISOString() })
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse<ApiResponse<{ code: string }>>> {
  try {
    const actor = await requireUser()
    const { id } = await context.params
    const payload = (await request.json()) as RegisterProductPayload
    const code = await ProductService.register(actor, id, payload)
    return NextResponse.json({ success: true, data: { code }, timestamp: new Date().toISOString() }, { status: 201 })
  } catch (error) {
    return toErrorResponse(error)
  }
}
