import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { toErrorResponse } from '@/lib/errors'
import { InvoiceService } from '@/lib/services/InvoiceService'
import type { ApiResponse } from '@/types/api'
import type { InvoiceAuditRecord, InvoiceRecord, UpdateInvoicePayload } from '@/types/invoice'

interface RouteContext {
  params: Promise<{ reference: string }>
}

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse<ApiResponse<{ invoice: InvoiceRecord; audits: InvoiceAuditRecord[]; canManage: boolean }>>> {
  try {
    const actor = await requireUser()
    const { reference } = await context.params
    const data = await InvoiceService.get(actor, reference)
    return NextResponse.json({ success: true, data, timestamp: new Date().toISOString() })
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse<ApiResponse<InvoiceRecord>>> {
  try {
    const actor = await requireUser()
    const { reference } = await context.params
    const payload = (await request.json()) as UpdateInvoicePayload
    const data = await InvoiceService.update(actor, reference, payload)
    return NextResponse.json({ success: true, data, timestamp: new Date().toISOString() })
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function DELETE(_request: Request, context: RouteContext): Promise<NextResponse<ApiResponse<never>>> {
  try {
    const actor = await requireUser()
    const { reference } = await context.params
    await InvoiceService.remove(actor, reference)
    return NextResponse.json({ success: true, timestamp: new Date().toISOString() })
  } catch (error) {
    return toErrorResponse(error)
  }
}
