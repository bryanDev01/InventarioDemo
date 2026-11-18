import { NextResponse } from 'next/server'
import { toErrorResponse } from '@/lib/errors'
import { AuthService } from '@/lib/services/AuthService'
import type { ApiResponse } from '@/types/api'
import type { AuthUser } from '@/types/user'

interface LoginBody {
  username: string
  password: string
}

export async function POST(request: Request): Promise<NextResponse<ApiResponse<AuthUser>>> {
  try {
    const body = (await request.json()) as LoginBody
    const user = await AuthService.login(body.username, body.password)
    return NextResponse.json({ success: true, data: user, timestamp: new Date().toISOString() })
  } catch (error) {
    return toErrorResponse(error)
  }
}
