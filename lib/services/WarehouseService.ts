import { AppError } from '@/lib/errors'
import { MESSAGES } from '@/lib/messages'
import { requireRole } from '@/lib/auth'
import { ROLES } from '@/lib/constants'
import type { RoleName } from '@/lib/constants'
import { UsersQuery } from '@/lib/queries/users'
import { WarehouseQuery } from '@/lib/queries/warehouses'
import { buildWarehouseId, buildWarehouseIdPrefix } from '@/lib/warehouseCode'
import type {
  CreateWarehousePayload,
  UpdateWarehousePayload,
  UpdateWarehouseStaffPayload,
  WarehouseOption,
  WarehouseRecord,
  WarehouseStaff,
} from '@/types/warehouse'

const ADMIN_ROLES: readonly RoleName[] = [ROLES.ADMIN]
const MAX_NAME_LENGTH = 80
const MAX_LOCATION_LENGTH = 160

const normalizeName = (name: string): string => name.trim().replace(/\s+/g, ' ')

const assertName = (name: unknown): string => {
  if (typeof name !== 'string' || normalizeName(name) === '') {
    throw new AppError(MESSAGES.warehouses.nameRequired, 400)
  }
  const normalized = normalizeName(name)
  if (normalized.length > MAX_NAME_LENGTH) throw new AppError(MESSAGES.warehouses.nameTooLong, 400)
  return normalized
}

const assertLocation = (location: unknown): string | null => {
  if (location === undefined || location === null) return null
  if (typeof location !== 'string') throw new AppError(MESSAGES.warehouses.invalidLocation, 400)
  const normalized = location.trim()
  if (normalized.length > MAX_LOCATION_LENGTH) throw new AppError(MESSAGES.warehouses.locationTooLong, 400)
  return normalized === '' ? null : normalized
}

const assertNameAvailable = async (name: string, excludeId: string | null): Promise<void> => {
  const key = name.toLowerCase()
  const taken = (await WarehouseQuery.listAll()).some(
    (warehouse) => warehouse.id !== excludeId && normalizeName(warehouse.name).toLowerCase() === key
  )
  if (taken) throw new AppError(MESSAGES.warehouses.nameTaken, 409)
}

const assertActive = async (id: string): Promise<void> => {
  const warehouse = await WarehouseQuery.findById(id)
  if (!warehouse || warehouse.is_archived) throw new AppError(MESSAGES.warehouses.notFound, 404)
}

interface Summary {
  productCount: number
  totalStock: number
  staff: WarehouseStaff[]
}

const buildSummaries = async (): Promise<Map<string, Summary>> => {
  const [assignments, inventory] = await Promise.all([WarehouseQuery.listAssignments(), WarehouseQuery.inventorySummary()])
  const summaries = new Map<string, Summary>()
  const ensure = (id: string): Summary => {
    const existing = summaries.get(id)
    if (existing) return existing
    const created: Summary = { productCount: 0, totalStock: 0, staff: [] }
    summaries.set(id, created)
    return created
  }
  for (const row of inventory) {
    const summary = ensure(row.warehouse_id)
    summary.productCount += 1
    summary.totalStock += row.stock
  }
  for (const assignment of assignments) {
    ensure(assignment.warehouse_id).staff.push({ id: assignment.user_id, username: assignment.username })
  }
  return summaries
}

const toRecord = (
  row: { id: string; name: string; location: string | null; created_at: string },
  summary: Summary | undefined
): WarehouseRecord => ({
  id: row.id,
  name: row.name,
  location: row.location,
  staff: summary?.staff ?? [],
  productCount: summary?.productCount ?? 0,
  totalStock: summary?.totalStock ?? 0,
  createdAt: row.created_at,
})

export class WarehouseService {
  static async list(): Promise<WarehouseRecord[]> {
    await requireRole(ADMIN_ROLES)
    const [rows, summaries] = await Promise.all([WarehouseQuery.listAll(), buildSummaries()])
    return rows.map((row) => toRecord(row, summaries.get(row.id)))
  }

  static async get(id: string): Promise<WarehouseRecord> {
    await requireRole(ADMIN_ROLES)
    const row = await WarehouseQuery.findById(id)
    if (!row || row.is_archived) throw new AppError(MESSAGES.warehouses.notFound, 404)
    const summaries = await buildSummaries()
    return toRecord(row, summaries.get(id))
  }

  static async listStaffCandidates(): Promise<WarehouseStaff[]> {
    await requireRole(ADMIN_ROLES)
    const rows = await UsersQuery.listActive()
    return rows
      .filter((user) => user.is_active && user.deleted_at === null && user.role !== ROLES.ADMIN)
      .map((user) => ({ id: user.id, username: user.username }))
  }

  static async listOptions(): Promise<WarehouseOption[]> {
    await requireRole(ADMIN_ROLES)
    const rows = await WarehouseQuery.listAll()
    return rows.map((row) => ({ id: row.id, name: row.name }))
  }

  static async create(payload: CreateWarehousePayload): Promise<WarehouseRecord> {
    await requireRole(ADMIN_ROLES)
    const name = assertName(payload.name)
    const location = assertLocation(payload.location)
    await assertNameAvailable(name, null)

    const prefix = buildWarehouseIdPrefix(name)
    if (!prefix) throw new AppError(MESSAGES.warehouses.nameNeedsLetters, 400)

    const existingIds = (await WarehouseQuery.listAll()).map((warehouse) => warehouse.id)
    const id = buildWarehouseId(prefix, existingIds)
    try {
      await WarehouseQuery.insert({ id, name, location })
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === '23505') {
        throw new AppError(MESSAGES.warehouses.idConflict, 409)
      }
      throw error
    }

    const created = await WarehouseQuery.findById(id)
    if (!created) throw new AppError(MESSAGES.common.unexpectedError, 500)
    return toRecord(created, undefined)
  }

  static async update(id: string, payload: UpdateWarehousePayload): Promise<WarehouseRecord> {
    await requireRole(ADMIN_ROLES)
    await assertActive(id)

    const patch: { name?: string; location?: string | null } = {}
    if (payload.name !== undefined) {
      const name = assertName(payload.name)
      await assertNameAvailable(name, id)
      patch.name = name
    }
    if (payload.location !== undefined) {
      patch.location = assertLocation(payload.location)
    }
    if (Object.keys(patch).length > 0) await WarehouseQuery.updateById(id, patch)

    return this.get(id)
  }

  static async archive(id: string): Promise<void> {
    await requireRole(ADMIN_ROLES)
    await assertActive(id)
    await WarehouseQuery.archive(id)
  }

  static async setStaff(id: string, payload: UpdateWarehouseStaffPayload): Promise<void> {
    await requireRole(ADMIN_ROLES)
    await assertActive(id)
    if (!Array.isArray(payload.userIds) || !payload.userIds.every((userId) => typeof userId === 'string')) {
      throw new AppError(MESSAGES.warehouses.invalidStaff, 400)
    }

    const userIds = Array.from(new Set(payload.userIds))
    const activeStaff = (await this.listStaffCandidates()).map((user) => user.id)
    if (userIds.some((userId) => !activeStaff.includes(userId))) {
      throw new AppError(MESSAGES.warehouses.invalidStaff, 400)
    }

    await WarehouseQuery.replaceStaff(id, userIds)
  }
}
