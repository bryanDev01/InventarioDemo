import { NextResponse } from 'next/server'
import { toErrorResponse } from '@/lib/errors'
import { AuthService } from '@/lib/services/AuthService'

export async function POST(request: Request): Promise<NextResponse> {
  try {
    await AuthService.logout()
    return NextResponse.redirect(new URL('/login', request.url), { status: 303 })
  } catch (error) {
    return toErrorResponse(error)
  }
}
