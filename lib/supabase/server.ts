import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { cookies } from 'next/headers'
import { connection } from 'next/server'

export const createClient = async (): Promise<SupabaseClient<Database>> => {
  await connection()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !publishableKey) throw new Error('Faltan las variables públicas de Supabase')
  const cookieStore = await cookies()
  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll: (): ReturnType<typeof cookieStore.getAll> => cookieStore.getAll(),
      setAll: (cookiesToSet): void => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Called from a Server Component, where cookies are read-only. The proxy refreshes the session.
        }
      },
    },
  })
}
