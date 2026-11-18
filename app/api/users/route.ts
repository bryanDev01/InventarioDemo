import { NextResponse } from 'next/server'
import { toErrorResponse } from '@/lib/errors'
import { UserService } from '@/lib/services/UserService'
import type { ApiResponse } from '@/types/api'
import type { CreateUserPayload, UserRecord } from '@/types/user'

export async function GET(): Promise<NextResponse<ApiResponse<UserRecord[]>>> {
  try {
    const data = await UserService.list()
    return NextResponse.json({ success: true, data, timestamp: new Date().toISOString() })
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function POST(request: Request): Promise<NextResponse<ApiResponse<UserRecord>>> {
  try {
    const payload = (await request.json()) as CreateUserPayload
    const data = await UserService.create(payload)
    return NextResponse.json({ success: true, data, timestamp: new Date().toISOString() }, { status: 201 })
  } catch (error) {
    return toErrorResponse(error)
  }
}
