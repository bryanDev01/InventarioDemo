import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { toErrorResponse } from '@/lib/errors'
import { InvoiceService } from '@/lib/services/InvoiceService'
import type { ApiResponse } from '@/types/api'

interface RouteContext {
  params: Promise<{ reference: string }>
}

export async function DELETE(_request: Request, context: RouteContext): Promise<NextResponse<ApiResponse<never>>> {
  try {
    const actor = await requireUser()
    const { reference } = await context.params
    await InvoiceService.purge(actor, reference)
    return NextResponse.json({ success: true, timestamp: new Date().toISOString() })
  } catch (error) {
    return toErrorResponse(error)
  }
}
