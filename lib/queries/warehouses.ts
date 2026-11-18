import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { WarehouseOption } from '@/types/warehouse'

export interface WarehouseRow {
  id: string
  name: string
  location: string | null
  created_at: string
}

export interface AssignmentRow {
  user_id: string
  warehouse_id: string
  username: string
  warehouse_name: string
}

interface AssignmentJoinRow {
  user_id: string
  warehouse_id: string
  profiles: { username: string } | null
  warehouses: { name: string } | null
}

const toAssignmentRow = (row: AssignmentJoinRow): AssignmentRow => ({
  user_id: row.user_id,
  warehouse_id: row.warehouse_id,
  username: row.profiles?.username ?? '',
  warehouse_name: row.warehouses?.name ?? '',
})

export interface WarehouseWithStatus extends WarehouseRow {
  is_archived: boolean
}

export const WarehouseQuery = {
  async listAll(): Promise<WarehouseRow[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('warehouses')
      .select('id, name, location, created_at')
      .eq('is_archived', false)
      .order('name')
    if (error) throw error
    return data as WarehouseRow[]
  },

  async findById(id: string): Promise<WarehouseWithStatus | null> {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('warehouses')
      .select('id, name, location, created_at, is_archived')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data as WarehouseWithStatus | null
  },

  async archive(id: string): Promise<void> {
    const admin = createAdminClient()
    const { error } = await admin
      .from('warehouses')
      .update({ is_archived: true, archived_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  },

  async inventorySummary(): Promise<{ warehouse_id: string; stock: number }[]> {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('warehouse_products')
      .select('warehouse_id, stock')
      .is('deleted_at', null)
    if (error) throw error
    return data as { warehouse_id: string; stock: number }[]
  },

  async listAssignments(): Promise<AssignmentRow[]> {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('user_warehouses')
      .select('user_id, warehouse_id, profiles(username), warehouses(name)')
    if (error) throw error
    return (data as unknown as AssignmentJoinRow[]).map(toAssignmentRow)
  },

  async listAssignmentsForUser(userId: string): Promise<WarehouseOption[]> {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('user_warehouses')
      .select('user_id, warehouse_id, profiles(username), warehouses(name)')
      .eq('user_id', userId)
    if (error) throw error
    return (data as unknown as AssignmentJoinRow[]).map((row) => ({
      id: row.warehouse_id,
      name: row.warehouses?.name ?? '',
    }))
  },

  async insert(row: { id: string; name: string; location: string | null }): Promise<void> {
    const admin = createAdminClient()
    const { error } = await admin.from('warehouses').insert(row)
    if (error) throw error
  },

  async updateById(id: string, patch: { name?: string; location?: string | null }): Promise<void> {
    const admin = createAdminClient()
    const { error } = await admin.from('warehouses').update(patch).eq('id', id)
    if (error) throw error
  },

  async replaceStaff(warehouseId: string, userIds: string[]): Promise<void> {
    const admin = createAdminClient()
    const { data, error } = await admin.from('user_warehouses').select('user_id').eq('warehouse_id', warehouseId)
    if (error) throw error
    const current = (data ?? []).map((row) => row.user_id)
    const toRemove = current.filter((id) => !userIds.includes(id))
    const toAdd = userIds.filter((id) => !current.includes(id))
    if (toRemove.length > 0) {
      const { error: deleteError } = await admin
        .from('user_warehouses')
        .delete()
        .eq('warehouse_id', warehouseId)
        .in('user_id', toRemove)
      if (deleteError) throw deleteError
    }
    if (toAdd.length > 0) {
      const { error: insertError } = await admin
        .from('user_warehouses')
        .insert(toAdd.map((userId) => ({ user_id: userId, warehouse_id: warehouseId })))
      if (insertError) throw insertError
    }
  },

  async replaceUserWarehouses(userId: string, warehouseIds: string[]): Promise<void> {
    const admin = createAdminClient()
    const { data, error } = await admin.from('user_warehouses').select('warehouse_id').eq('user_id', userId)
    if (error) throw error
    const current = (data ?? []).map((row) => row.warehouse_id)
    const toRemove = current.filter((id) => !warehouseIds.includes(id))
    const toAdd = warehouseIds.filter((id) => !current.includes(id))
    if (toRemove.length > 0) {
      const { error: deleteError } = await admin
        .from('user_warehouses')
        .delete()
        .eq('user_id', userId)
        .in('warehouse_id', toRemove)
      if (deleteError) throw deleteError
    }
    if (toAdd.length > 0) {
      const { error: insertError } = await admin
        .from('user_warehouses')
        .insert(toAdd.map((warehouseId) => ({ user_id: userId, warehouse_id: warehouseId })))
      if (insertError) throw insertError
    }
  },
}

export const listAssignedWarehousesForCurrentUser = async (userId: string): Promise<WarehouseOption[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('user_warehouses')
    .select('warehouse_id, warehouses(name)')
    .eq('user_id', userId)
  if (error) throw error
  return (data as unknown as { warehouse_id: string; warehouses: { name: string } | null }[])
    .filter((row) => row.warehouses !== null)
    .map((row) => ({
      id: row.warehouse_id,
      name: row.warehouses?.name ?? '',
    }))
}
