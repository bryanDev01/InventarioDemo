import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { RoleName } from '@/lib/constants'
import type { UserRecord } from '@/types/user'
import type { WarehouseOption } from '@/types/warehouse'

export interface ProfileWithRole {
  id: string
  username: string
  role: RoleName
  is_active: boolean
  deleted_at: string | null
  created_at: string
  roles: { label: string } | null
}

const PROFILE_SELECT = 'id, username, role, is_active, deleted_at, created_at, roles(label)'

export const toUserRecord = (row: ProfileWithRole, warehouses: WarehouseOption[]): UserRecord => ({
  id: row.id,
  username: row.username,
  role: row.role,
  roleLabel: row.roles?.label ?? row.role,
  isActive: row.is_active,
  createdAt: row.created_at,
  warehouses,
})

export interface RoleOption {
  name: RoleName
  label: string
}

export const UsersQuery = {
  async listRoles(): Promise<RoleOption[]> {
    const supabase = await createClient()
    const { data, error } = await supabase.from('roles').select('name, label').order('label')
    if (error) throw error
    return data as RoleOption[]
  },

  async listActive(): Promise<ProfileWithRole[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_SELECT)
      .is('deleted_at', null)
      .order('username')
    if (error) throw error
    return data as ProfileWithRole[]
  },

  async findById(id: string): Promise<ProfileWithRole | null> {
    const admin = createAdminClient()
    const { data, error } = await admin.from('profiles').select(PROFILE_SELECT).eq('id', id).maybeSingle()
    if (error) throw error
    return data as ProfileWithRole | null
  },

  async findByUsername(username: string): Promise<ProfileWithRole | null> {
    const admin = createAdminClient()
    const { data, error } = await admin.from('profiles').select(PROFILE_SELECT).eq('username', username).maybeSingle()
    if (error) throw error
    return data as ProfileWithRole | null
  },

  async countOtherActiveAdmins(excludeId: string): Promise<number> {
    const admin = createAdminClient()
    const { count, error } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin')
      .eq('is_active', true)
      .is('deleted_at', null)
      .neq('id', excludeId)
    if (error) throw error
    return count ?? 0
  },

  async roleExists(role: string): Promise<boolean> {
    const admin = createAdminClient()
    const { data, error } = await admin.from('roles').select('name').eq('name', role).maybeSingle()
    if (error) throw error
    return data !== null
  },

  async updateById(id: string, patch: Partial<Pick<ProfileWithRole, 'username' | 'role' | 'is_active' | 'deleted_at'>>): Promise<void> {
    const admin = createAdminClient()
    const { error } = await admin.from('profiles').update(patch).eq('id', id)
    if (error) throw error
  },
}
