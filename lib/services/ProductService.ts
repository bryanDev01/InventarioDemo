import { AppError, getErrorMessage } from '@/lib/errors'
import { MESSAGES } from '@/lib/messages'
import { requireRole } from '@/lib/auth'
import { ROLES } from '@/lib/constants'
import type { RoleName } from '@/lib/constants'
import { parseBasePriceToCents, parseStock } from '@/lib/validators'
import { ProductQuery } from '@/lib/queries/products'
import { WarehouseQuery } from '@/lib/queries/warehouses'
import type { AuthUser } from '@/types/user'
import type { ProductRecord, RegisterProductPayload, UpdateInventoryPayload } from '@/types/product'

const ADMIN_ROLES: readonly RoleName[] = [ROLES.ADMIN]
const MAX_PRODUCT_NAME_LENGTH = 160
const CODE_PATTERN = /^[A-Z0-9-]{1,30}$/

const normalizeName = (name: string): string => name.trim().replace(/\s+/g, ' ')

const assertProductName = (name: unknown): string => {
  if (typeof name !== 'string' || normalizeName(name) === '') throw new AppError(MESSAGES.products.nameRequired, 400)
  const normalized = normalizeName(name)
  if (normalized.length > MAX_PRODUCT_NAME_LENGTH) throw new AppError(MESSAGES.products.nameTooLong, 400)
  return normalized
}

const assertPrice = (value: unknown): { cents: number; decimal: string } => {
  const cents = typeof value === 'string' ? parseBasePriceToCents(value) : null
  if (cents === null) throw new AppError(MESSAGES.validation.invalidPrice, 400)
  return { cents, decimal: (cents / 100).toFixed(2) }
}

const assertStock = (value: unknown): number => {
  const stock = typeof value === 'string' ? parseStock(value) : null
  if (stock === null) throw new AppError(MESSAGES.validation.invalidStock, 400)
  return stock
}

const assertOptionalCode = (value: unknown): string | null => {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string') throw new AppError(MESSAGES.products.invalidCode, 400)
  const code = value.trim().toUpperCase()
  if (code === '') return null
  if (!CODE_PATTERN.test(code)) throw new AppError(MESSAGES.products.invalidCode, 400)
  return code
}

const normalizeProductName = (name: string): string =>
  name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()

const mapRpcError = (error: unknown): never => {
  const message = getErrorMessage(error)
  if (message.includes('NAME_MISMATCH')) throw new AppError(MESSAGES.products.nameMismatch, 409)
  if (message.includes('DUPLICATE_IN_WAREHOUSE')) throw new AppError(MESSAGES.products.duplicateInWarehouse, 409)
  if (message.includes('PRODUCT_NOT_FOUND')) throw new AppError(MESSAGES.products.notFound, 404)
  if (message.includes('NEGATIVE_STOCK')) throw new AppError(MESSAGES.validation.invalidStock, 400)
  throw error
}

const assertWarehouseActive = async (warehouseId: string): Promise<void> => {
  const warehouse = await WarehouseQuery.findById(warehouseId)
  if (!warehouse || warehouse.is_archived) throw new AppError(MESSAGES.warehouses.notFound, 404)
}

export class ProductService {
  static async listInventory(warehouseId: string): Promise<ProductRecord[]> {
    await requireRole(ADMIN_ROLES)
    await assertWarehouseActive(warehouseId)
    const rows = await ProductQuery.listInventory(warehouseId)
    return rows
      .map((row) => ({
        code: row.product_code,
        name: row.products?.name ?? '',
        basePriceUsdCents: Math.round(Number(row.base_price_usd) * 100),
        stock: row.stock,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }

  static async register(actor: AuthUser, warehouseId: string, payload: RegisterProductPayload): Promise<string> {
    await requireRole(ADMIN_ROLES)
    await assertWarehouseActive(warehouseId)
    const code = assertOptionalCode(payload.code)
    const name = assertProductName(payload.name)
    const price = assertPrice(payload.basePrice)
    const stock = assertStock(payload.stock)

    if (code !== null) {
      const existing = await ProductQuery.findProduct(code)
      if (existing && normalizeProductName(existing.name) !== normalizeProductName(name)) {
        throw new AppError(MESSAGES.products.nameMismatch, 409)
      }
    }

    try {
      return await ProductQuery.registerProduct({
        warehouseId,
        code,
        name,
        basePrice: price.cents / 100,
        stock,
        userId: actor.id,
      })
    } catch (error) {
      return mapRpcError(error)
    }
  }

  static async update(actor: AuthUser, warehouseId: string, code: string, payload: UpdateInventoryPayload): Promise<void> {
    await requireRole(ADMIN_ROLES)
    await assertWarehouseActive(warehouseId)
    const item = await ProductQuery.findInventoryItem(warehouseId, code)
    if (!item) throw new AppError(MESSAGES.products.notFound, 404)

    const name = payload.name === undefined ? undefined : assertProductName(payload.name)
    const price = payload.basePrice === undefined ? undefined : assertPrice(payload.basePrice)
    const stock = payload.stock === undefined ? undefined : assertStock(payload.stock)

    if (name !== undefined && name !== item.products?.name) {
      const product = await ProductQuery.findProduct(code)
      if (!product) throw new AppError(MESSAGES.products.notFound, 404)
      await ProductQuery.renameProduct(code, name)
    }
    if (price !== undefined && price.cents !== Math.round(Number(item.base_price_usd) * 100)) {
      await ProductQuery.updatePrice(warehouseId, code, price.cents)
    }
    if (stock !== undefined && stock !== item.stock) {
      try {
        await ProductQuery.setWarehouseStock({
          warehouseId,
          code,
          newStock: stock,
          userId: actor.id,
          observation: payload.observation ?? null,
        })
      } catch (error) {
        mapRpcError(error)
      }
    }
  }

  static async removeFromInventory(warehouseId: string, code: string): Promise<void> {
    await requireRole(ADMIN_ROLES)
    await assertWarehouseActive(warehouseId)
    const item = await ProductQuery.findInventoryItem(warehouseId, code)
    if (!item) throw new AppError(MESSAGES.products.notFound, 404)
    await ProductQuery.softDeleteFromInventory(warehouseId, code)
  }
}
