import { AppError } from '@/lib/errors'
import { MESSAGES } from '@/lib/messages'
import { requireRole } from '@/lib/auth'
import { ROLES } from '@/lib/constants'
import type { RoleName } from '@/lib/constants'
import { ProductQuery } from '@/lib/queries/products'
import { WarehouseQuery } from '@/lib/queries/warehouses'
import { WarehouseService } from '@/lib/services/WarehouseService'
import type { AuthUser } from '@/types/user'
import type { PosCatalog } from '@/types/pos'
import type { WarehouseOption } from '@/types/warehouse'

const POS_ROLES: readonly RoleName[] = [ROLES.ADMIN, ROLES.INVOICER]

export const assertWarehouseAccess = (actor: AuthUser, warehouseId: string): void => {
  if (actor.role === ROLES.ADMIN) return
  if (!actor.warehouses.some((warehouse) => warehouse.id === warehouseId)) {
    throw new AppError(MESSAGES.auth.forbidden, 403)
  }
}

export class PosService {
  static async catalog(actor: AuthUser, requestedWarehouseId: string | null): Promise<PosCatalog> {
    await requireRole(POS_ROLES)

    const warehouses: WarehouseOption[] = actor.role === ROLES.ADMIN
      ? await WarehouseService.listOptions()
      : actor.warehouses

    const warehouseId = requestedWarehouseId ?? warehouses[0]?.id ?? null
    if (warehouseId === null) return { warehouses, warehouseId: null, products: [] }
    if (!warehouses.some((warehouse) => warehouse.id === warehouseId)) {
      throw new AppError(MESSAGES.auth.forbidden, 403)
    }

    const warehouse = await WarehouseQuery.findById(warehouseId)
    if (!warehouse || warehouse.is_archived) throw new AppError(MESSAGES.warehouses.notFound, 404)

    const rows = await ProductQuery.listInventory(warehouseId)
    const products = rows
      .map((row) => ({
        code: row.product_code,
        name: row.products?.name ?? '',
        basePriceUsdCents: Math.round(Number(row.base_price_usd) * 100),
        stock: row.stock,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))

    return { warehouses, warehouseId, products }
  }
}
