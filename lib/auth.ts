import { AppError } from '@/lib/errors'
import { MESSAGES } from '@/lib/messages'
import { createClient } from '@/lib/supabase/server'
import { listAssignedWarehousesForCurrentUser } from '@/lib/queries/warehouses'
import type { RoleName } from '@/lib/constants'
import type { AuthUser } from '@/types/user'

interface ProfileRow {
  id: string
  username: string
  role: RoleName
  is_active: boolean
  deleted_at: string | null
}

export const getActiveProfile = async (userId: string): Promise<AuthUser | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, role, is_active, deleted_at')
    .eq('id', userId)
    .maybeSingle<ProfileRow>()
  if (error) throw error
  if (!data || !data.is_active || data.deleted_at !== null) return null
  const warehouses = await listAssignedWarehousesForCurrentUser(data.id)
  return {
    id: data.id,
    username: data.username,
    role: data.role,
    isActive: data.is_active,
    warehouses,
  }
}

export const requireUser = async (): Promise<AuthUser> => {
  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  if (claimsError || !claimsData) throw new AppError(MESSAGES.auth.noSession, 401)

  const user = await getActiveProfile(claimsData.claims.sub)
  if (!user) throw new AppError(MESSAGES.auth.noSession, 401)
  return user
}

export const getCurrentUser = async (): Promise<AuthUser | null> => {
  try {
    return await requireUser()
  } catch (error) {
    if (error instanceof AppError && error.status === 401) return null
    throw error
  }
}

export const requireRole = async (allowedRoles: readonly RoleName[]): Promise<AuthUser> => {
  const user = await requireUser()
  if (!allowedRoles.includes(user.role)) throw new AppError(MESSAGES.auth.forbidden, 403)
  return user
}
