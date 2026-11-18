import { AppError } from '@/lib/errors'
import { MESSAGES } from '@/lib/messages'
import { requireRole } from '@/lib/auth'
import { ROLES } from '@/lib/constants'
import type { RoleName } from '@/lib/constants'
import { UsersQuery, toUserRecord } from '@/lib/queries/users'
import { WarehouseQuery } from '@/lib/queries/warehouses'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildInternalEmail, isValidUsername, normalizeUsername } from '@/lib/validators'
import type { AuthUser, CreateUserPayload, UpdateUserPayload, UserRecord } from '@/types/user'
import type { WarehouseOption } from '@/types/warehouse'

const ADMIN_ROLES: readonly RoleName[] = [ROLES.ADMIN]

const assertValidUsername = (username: unknown): string => {
  if (typeof username !== 'string' || !isValidUsername(username)) {
    throw new AppError(MESSAGES.validation.invalidUsername, 400)
  }
  return normalizeUsername(username)
}

const assertRoleExists = async (role: unknown): Promise<RoleName> => {
  if (typeof role !== 'string' || !(await UsersQuery.roleExists(role))) {
    throw new AppError(MESSAGES.users.roleNotFound, 400)
  }
  return role as RoleName
}

const assertWarehouseIds = async (warehouseIds: unknown): Promise<string[]> => {
  if (!Array.isArray(warehouseIds) || !warehouseIds.every((id): id is string => typeof id === 'string')) {
    throw new AppError(MESSAGES.warehouses.invalidSelection, 400)
  }
  const unique = Array.from(new Set(warehouseIds))
  const existing = (await WarehouseQuery.listAll()).map((warehouse) => warehouse.id)
  if (unique.some((id) => !existing.includes(id))) throw new AppError(MESSAGES.warehouses.invalidSelection, 400)
  return unique
}

const assertNotSelf = (actor: AuthUser, targetId: string, message: string): void => {
  if (actor.id === targetId) throw new AppError(message, 409)
}

const assertNotLastActiveAdmin = async (targetId: string): Promise<void> => {
  const others = await UsersQuery.countOtherActiveAdmins(targetId)
  if (others === 0) throw new AppError(MESSAGES.users.lastActiveAdmin, 409)
}

const groupAssignmentsByUser = (rows: { user_id: string; warehouse_id: string; warehouse_name: string }[]): Map<string, WarehouseOption[]> => {
  const grouped = new Map<string, WarehouseOption[]>()
  for (const row of rows) {
    const list = grouped.get(row.user_id) ?? []
    list.push({ id: row.warehouse_id, name: row.warehouse_name })
    grouped.set(row.user_id, list)
  }
  return grouped
}

export class UserService {
  static async list(): Promise<UserRecord[]> {
    await requireRole(ADMIN_ROLES)
    const [rows, assignments] = await Promise.all([UsersQuery.listActive(), WarehouseQuery.listAssignments()])
    const grouped = groupAssignmentsByUser(assignments)
    return rows.map((row) => toUserRecord(row, grouped.get(row.id) ?? []))
  }

  static async create(payload: CreateUserPayload): Promise<UserRecord> {
    await requireRole(ADMIN_ROLES)
    const username = assertValidUsername(payload.username)
    const role = await assertRoleExists(payload.role)
    const warehouseIds = payload.warehouseIds === undefined ? [] : await assertWarehouseIds(payload.warehouseIds)
    if (typeof payload.password !== 'string' || payload.password === '') {
      throw new AppError(MESSAGES.users.passwordRequired, 400)
    }
    if (await UsersQuery.findByUsername(username)) throw new AppError(MESSAGES.users.usernameTaken, 409)

    const admin = createAdminClient()
    const { data, error } = await admin.auth.admin.createUser({
      email: buildInternalEmail(username),
      password: payload.password,
      email_confirm: true,
    })
    if (error || !data.user) throw new AppError(MESSAGES.users.createFailed, 400)

    const { error: profileError } = await admin.from('profiles').insert({
      id: data.user.id,
      username,
      role,
    })
    if (profileError) {
      await admin.auth.admin.deleteUser(data.user.id)
      throw profileError
    }

    await WarehouseQuery.replaceUserWarehouses(data.user.id, warehouseIds)

    const created = await UsersQuery.findById(data.user.id)
    if (!created) throw new AppError(MESSAGES.common.unexpectedError, 500)
    const warehouses = await WarehouseQuery.listAssignmentsForUser(created.id)
    return toUserRecord(created, warehouses)
  }

  static async update(actor: AuthUser, targetId: string, payload: UpdateUserPayload): Promise<UserRecord> {
    await requireRole(ADMIN_ROLES)
    const target = await UsersQuery.findById(targetId)
    if (!target || target.deleted_at !== null) throw new AppError(MESSAGES.users.notFound, 404)

    const patch: Partial<Pick<typeof target, 'username' | 'role' | 'is_active'>> = {}
    const authAttributes: { email?: string; password?: string; email_confirm?: boolean } = {}

    if (payload.username !== undefined) {
      const username = assertValidUsername(payload.username)
      if (username !== target.username) {
        assertNotSelf(actor, targetId, MESSAGES.users.cannotChangeOwnUsername)
        const taken = await UsersQuery.findByUsername(username)
        if (taken) throw new AppError(MESSAGES.users.usernameTaken, 409)
        patch.username = username
        authAttributes.email = buildInternalEmail(username)
        authAttributes.email_confirm = true
      }
    }

    if (payload.password !== undefined && payload.password !== '') {
      authAttributes.password = payload.password
    }

    if (payload.role !== undefined && payload.role !== target.role) {
      assertNotSelf(actor, targetId, MESSAGES.users.cannotChangeOwnRole)
      const role = await assertRoleExists(payload.role)
      if (target.role === ROLES.ADMIN && target.is_active) await assertNotLastActiveAdmin(targetId)
      patch.role = role
    }

    if (payload.isActive !== undefined && payload.isActive !== target.is_active) {
      assertNotSelf(actor, targetId, MESSAGES.users.cannotChangeOwnStatus)
      if (!payload.isActive && target.role === ROLES.ADMIN) await assertNotLastActiveAdmin(targetId)
      patch.is_active = payload.isActive
    }

    const warehouseIds = payload.warehouseIds === undefined ? undefined : await assertWarehouseIds(payload.warehouseIds)

    const admin = createAdminClient()
    if (Object.keys(authAttributes).length > 0) {
      const { error } = await admin.auth.admin.updateUserById(targetId, authAttributes)
      if (error) throw new AppError(MESSAGES.users.updateFailed, 400)
    }
    if (Object.keys(patch).length > 0) {
      await UsersQuery.updateById(targetId, patch)
    }
    if (warehouseIds !== undefined) {
      await WarehouseQuery.replaceUserWarehouses(targetId, warehouseIds)
    }

    const updated = await UsersQuery.findById(targetId)
    if (!updated) throw new AppError(MESSAGES.users.notFound, 404)
    const warehouses = await WarehouseQuery.listAssignmentsForUser(targetId)
    return toUserRecord(updated, warehouses)
  }

  static async remove(actor: AuthUser, targetId: string): Promise<void> {
    await requireRole(ADMIN_ROLES)
    const target = await UsersQuery.findById(targetId)
    if (!target || target.deleted_at !== null) throw new AppError(MESSAGES.users.notFound, 404)
    assertNotSelf(actor, targetId, MESSAGES.users.cannotChangeOwnStatus)
    if (target.role === ROLES.ADMIN && target.is_active) await assertNotLastActiveAdmin(targetId)

    await UsersQuery.updateById(targetId, { is_active: false, deleted_at: new Date().toISOString() })
  }
}
