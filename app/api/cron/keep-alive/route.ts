import { NextResponse } from 'next/server'
import { AppError, toErrorResponse } from '@/lib/errors'
import { MESSAGES } from '@/lib/messages'
import { createClient } from '@/lib/supabase/server'
import type { ApiResponse } from '@/types/api'

export async function GET(request: Request): Promise<NextResponse<ApiResponse<never>>> {
  try {
    const secret = process.env.CRON_SECRET
    if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
      throw new AppError(MESSAGES.auth.noSession, 401)
    }

    const supabase = await createClient()
    const results = await Promise.all([
      supabase.from('roles').select('name').limit(1),
      supabase.from('roles').select('name').limit(1),
      supabase.from('roles').select('name').limit(1),
    ])
    const failed = results.find((result) => result.error)
    if (failed?.error) throw failed.error

    return NextResponse.json({ success: true, timestamp: new Date().toISOString() })
  } catch (error) {
    return toErrorResponse(error)
  }
}
