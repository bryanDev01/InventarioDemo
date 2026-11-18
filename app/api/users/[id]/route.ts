import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { toErrorResponse } from '@/lib/errors'
import { UserService } from '@/lib/services/UserService'
import type { ApiResponse } from '@/types/api'
import type { UpdateUserPayload, UserRecord } from '@/types/user'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse<ApiResponse<UserRecord>>> {
  try {
    const actor = await requireUser()
    const { id } = await context.params
    const payload = (await request.json()) as UpdateUserPayload
    const data = await UserService.update(actor, id, payload)
    return NextResponse.json({ success: true, data, timestamp: new Date().toISOString() })
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function DELETE(_request: Request, context: RouteContext): Promise<NextResponse<ApiResponse<never>>> {
  try {
    const actor = await requireUser()
    const { id } = await context.params
    await UserService.remove(actor, id)
    return NextResponse.json({ success: true, timestamp: new Date().toISOString() })
  } catch (error) {
    return toErrorResponse(error)
  }
}
