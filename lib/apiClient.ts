import { MESSAGES } from '@/lib/messages'
import type { ApiResponse } from '@/types/api'

export const apiRequest = async <T>(url: string, init: RequestInit = {}): Promise<T | undefined> => {
  const headers = new Headers(init.headers)
  if (typeof FormData === 'undefined' || !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  const response = await fetch(url, {
    ...init,
    headers,
  })
  let body: ApiResponse<T>
  try {
    body = (await response.json()) as ApiResponse<T>
  } catch {
    throw new Error(MESSAGES.common.unexpectedError)
  }
  if (!response.ok || !body.success) throw new Error(body.error ?? MESSAGES.common.unexpectedError)
  return body.data
}
