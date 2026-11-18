import { AppError, getErrorMessage } from '@/lib/errors'
import { MESSAGES } from '@/lib/messages'
import { requireRole } from '@/lib/auth'
import { MOVEMENT_TYPES, ROLES } from '@/lib/constants'
import type { MovementType, RoleName } from '@/lib/constants'
import { parseQuantity } from '@/lib/validators'
import { StockMovementQuery, StockMovementRow } from '@/lib/queries/stockMovements'
import { WarehouseQuery } from '@/lib/queries/warehouses'
import type { AuthUser } from '@/types/user'
import type {
  CreateStockMovementPayload,
  ManualMovementType,
  StockMovementFilters,
  StockMovementListResult,
  StockMovementRecord,
} from '@/types/stockMovement'

const ADMIN_ROLES: readonly RoleName[] = [ROLES.ADMIN]
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MANUAL_TYPES: readonly ManualMovementType[] = ['entry', 'exit', 'transfer']
const MAX_OBSERVATION_LENGTH = 300

const parseDate = (value: string | undefined): string | undefined => {
  if (value === undefined || value === '') return undefined
  if (!DATE_PATTERN.test(value)) throw new AppError(MESSAGES.stockMovements.errors.invalidFilters, 400)
  return value
}

const parseListFilters = (raw: Record<string, string | undefined>): StockMovementFilters => {
  const page = Math.max(1, Number.parseInt(raw.page ?? '1', 10) || 1)
  const from = parseDate(raw.from)
  const to = parseDate(raw.to)
  if (from && to && to < from) throw new AppError(MESSAGES.stockMovements.errors.invalidFilters, 400)
  const type = raw.type && Object.values(MOVEMENT_TYPES).includes(raw.type as MovementType)
    ? (raw.type as MovementType)
    : undefined
  return {
    warehouseId: raw.warehouseId === '' ? undefined : raw.warehouseId,
    product: raw.product,
    type,
    from,
    to,
    page,
  }
}

const toRecord = (row: StockMovementRow): StockMovementRecord => ({
  id: row.id,
  warehouseId: row.warehouse_id,
  warehouseName: row.warehouses?.name ?? row.warehouse_id,
  productCode: row.product_code,
  productName: row.products?.name ?? '',
  type: row.movement_type as MovementType,
  quantity: row.quantity,
  stockAfter: row.stock_after,
  observation: row.observation,
  username: row.profiles?.username ?? '',
  createdAt: row.created_at,
})

const assertType = (value: unknown): ManualMovementType => {
  if (typeof value !== 'string' || !MANUAL_TYPES.includes(value as ManualMovementType)) {
    throw new AppError(MESSAGES.stockMovements.errors.invalidType, 400)
  }
  return value as ManualMovementType
}

const assertActiveWarehouse = async (value: unknown): Promise<string> => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new AppError(MESSAGES.stockMovements.errors.invalidWarehouse, 400)
  }
  const warehouse = await WarehouseQuery.findById(value)
  if (!warehouse || warehouse.is_archived) {
    throw new AppError(MESSAGES.stockMovements.errors.invalidWarehouse, 404)
  }
  return value
}

const assertProductCode = (value: unknown): string => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new AppError(MESSAGES.stockMovements.errors.invalidProduct, 400)
  }
  return value.trim().toUpperCase()
}

const assertObservation = (value: unknown): string | null => {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') throw new AppError(MESSAGES.stockMovements.errors.observationTooLong, 400)
  const observation = value.trim().replace(/\s+/g, ' ')
  if (observation.length > MAX_OBSERVATION_LENGTH) {
    throw new AppError(MESSAGES.stockMovements.errors.observationTooLong, 400)
  }
  return observation === '' ? null : observation
}

const mapRpcError = (error: unknown): never => {
  const message = getErrorMessage(error)
  if (message.includes('STOCK_INSUFFICIENT')) throw new AppError(MESSAGES.stockMovements.errors.stockInsufficient, 409)
  if (message.includes('PRODUCT_NOT_FOUND')) throw new AppError(MESSAGES.stockMovements.errors.productNotFound, 404)
  if (message.includes('WAREHOUSE_NOT_FOUND')) throw new AppError(MESSAGES.stockMovements.errors.invalidWarehouse, 404)
  if (message.includes('SAME_WAREHOUSE')) throw new AppError(MESSAGES.stockMovements.errors.sameWarehouse, 400)
  if (message.includes('INVALID_QUANTITY')) throw new AppError(MESSAGES.stockMovements.errors.invalidQuantity, 400)
  throw error
}

export class StockMovementService {
  static async list(actor: AuthUser, raw: Record<string, string | undefined>): Promise<StockMovementListResult> {
    await requireRole(ADMIN_ROLES)
    const filters = parseListFilters(raw)
    const { rows, hasNext } = await StockMovementQuery.list(filters)
    return { items: rows.map(toRecord), page: filters.page, hasNext }
  }

  static async create(actor: AuthUser, payload: CreateStockMovementPayload): Promise<void> {
    await requireRole(ADMIN_ROLES)

    const type = assertType(payload.type)
    const warehouseId = await assertActiveWarehouse(payload.warehouseId)
    const code = assertProductCode(payload.productCode)
    const quantity = typeof payload.quantity === 'string' ? parseQuantity(payload.quantity) : null
    if (quantity === null) throw new AppError(MESSAGES.stockMovements.errors.invalidQuantity, 400)
    const observation = assertObservation(payload.observation)

    try {
      if (type === 'entry') {
        await StockMovementQuery.registerEntry({
          warehouseId,
          code,
          quantity,
          observation,
          userId: actor.id,
        })
        return
      }

      if (type === 'exit') {
        await StockMovementQuery.registerExit({
          warehouseId,
          code,
          quantity,
          observation,
          userId: actor.id,
        })
        return
      }

      const destinationId = await assertActiveWarehouse(payload.destinationWarehouseId)
      if (destinationId === warehouseId) throw new AppError(MESSAGES.stockMovements.errors.sameWarehouse, 400)

      await StockMovementQuery.transfer({
        originId: warehouseId,
        destinationId,
        code,
        quantity,
        observation,
        userId: actor.id,
      })
    } catch (error) {
      mapRpcError(error)
    }
  }
}
