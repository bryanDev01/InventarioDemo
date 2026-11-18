import { NextResponse } from 'next/server'
import type { ApiResponse } from '@/types/api'
import { MESSAGES } from '@/lib/messages'

export class AppError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
  }
}

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') return error.message
  return ''
}

export const toErrorResponse = (error: unknown): NextResponse<ApiResponse<never>> => {
  const isAppError = error instanceof AppError
  if (!isAppError) console.error('Unexpected error:', error)
  return NextResponse.json(
    {
      success: false,
      error: isAppError ? error.message : MESSAGES.common.unexpectedError,
      timestamp: new Date().toISOString(),
    },
    { status: isAppError ? error.status : 500 }
  )
}
