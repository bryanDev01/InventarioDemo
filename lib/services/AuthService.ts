import { AppError } from '@/lib/errors'
import { MESSAGES } from '@/lib/messages'
import { getActiveProfile } from '@/lib/auth'
import { buildInternalEmail, isValidUsername, normalizeUsername } from '@/lib/validators'
import { createClient } from '@/lib/supabase/server'
import type { AuthUser } from '@/types/user'

export class AuthService {
  static async login(username: string, password: string): Promise<AuthUser> {
    if (typeof username !== 'string' || typeof password !== 'string' || !isValidUsername(username) || password === '') {
      throw new AppError(MESSAGES.auth.invalidCredentials, 401)
    }

    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email: buildInternalEmail(normalizeUsername(username)),
      password,
    })
    if (error || !data.user) throw new AppError(MESSAGES.auth.invalidCredentials, 401)

    const profile = await getActiveProfile(data.user.id)
    if (!profile) {
      await supabase.auth.signOut()
      throw new AppError(MESSAGES.auth.invalidCredentials, 401)
    }
    return profile
  }

  static async logout(): Promise<void> {
    const supabase = await createClient()
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }
}
