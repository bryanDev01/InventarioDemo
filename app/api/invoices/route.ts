import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { toErrorResponse } from '@/lib/errors'
import { InvoiceService } from '@/lib/services/InvoiceService'
import type { ApiResponse } from '@/types/api'
import type { CreateInvoicePayload, InvoiceListResult, InvoiceRecord } from '@/types/invoice'

export async function GET(request: Request): Promise<NextResponse<ApiResponse<InvoiceListResult>>> {
  try {
    const actor = await requireUser()
    const params = Object.fromEntries(new URL(request.url).searchParams.entries())
    const data = await InvoiceService.list(actor, params)
    return NextResponse.json({ success: true, data, timestamp: new Date().toISOString() })
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function POST(request: Request): Promise<NextResponse<ApiResponse<InvoiceRecord>>> {
  try {
    const actor = await requireUser()
    const payload = (await request.json()) as CreateInvoicePayload
    const data = await InvoiceService.create(actor, payload)
    return NextResponse.json({ success: true, data, timestamp: new Date().toISOString() }, { status: 201 })
  } catch (error) {
    return toErrorResponse(error)
  }
}
