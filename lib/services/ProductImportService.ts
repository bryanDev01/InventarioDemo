import { AppError, getErrorMessage } from '@/lib/errors'
import { MESSAGES } from '@/lib/messages'
import { parseBasePriceToCents, parseStock } from '@/lib/validators'
import { ProductQuery } from '@/lib/queries/products'
import type { ProductRow, ImportInventoryRow } from '@/lib/queries/products'
import { WarehouseQuery } from '@/lib/queries/warehouses'
import { requireRole } from '@/lib/auth'
import { ROLES } from '@/lib/constants'
import type { RoleName } from '@/lib/constants'
import type {
  InventoryImportNameMode,
  InventoryImportPreview,
  InventoryImportPreviewRow,
  InventoryImportRpcRow,
  InventoryImportResult,
  InventoryImportRow,
} from '@/types/inventoryImport'

const ADMIN_ROLES: readonly RoleName[] = [ROLES.ADMIN]
const MAX_IMPORT_ROWS = 2000
const CODE_PATTERN = /^[A-Z0-9-]{1,30}$/
const MAX_NAME_LENGTH = 160
const MAX_STOCK = 2147483647
const MAX_BASE_PRICE_CENTS = 999999999999

const normalizeProductName = (value: string): string => value
  .normalize('NFD')
  .replace(/\p{M}/gu, '')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim()

interface NormalizedRow extends InventoryImportRow {
  basePriceCents: number | null
  stockValue: number | null
  errors: string[]
}

const normalizeImportPrice = (value: string): string => {
  let cleaned = value.trim().replace(/\s/g, '').replace(/[^\d.,-]/g, '')
  if (cleaned === '' || cleaned.startsWith('-')) return ''

  const commaIndex = cleaned.lastIndexOf(',')
  const dotIndex = cleaned.lastIndexOf('.')
  if (commaIndex !== -1 && dotIndex !== -1) {
    const decimalSeparator = commaIndex > dotIndex ? ',' : '.'
    const groupSeparator = decimalSeparator === ',' ? '.' : ','
    cleaned = cleaned.split(groupSeparator).join('')
    if (decimalSeparator === ',') cleaned = cleaned.replace(',', '.')
    return cleaned
  }

  const separator = commaIndex !== -1 ? ',' : dotIndex !== -1 ? '.' : ''
  if (separator === '') return cleaned
  const parts = cleaned.split(separator)
  const lastPart = parts[parts.length - 1] ?? ''
  const isThousandsGrouping = parts.length > 1 && lastPart.length === 3 && parts.slice(0, -1).every((part) => /^\d{1,3}$/.test(part))
  if (isThousandsGrouping) return parts.join('')
  if (separator === ',') cleaned = cleaned.replace(',', '.')
  return cleaned
}

const normalizeStock = (value: string): string => {
  const cleaned = value.trim().replace(/\s/g, '')
  if (/^\d{1,3}([,.]\d{3})+$/.test(cleaned)) return cleaned.replace(/[,.]/g, '')
  return cleaned
}

const normalizeRow = (value: unknown, index: number): NormalizedRow => {
  const row = typeof value === 'object' && value !== null ? value as Partial<InventoryImportRow> : {}
  const code = typeof row.code === 'string' ? row.code.trim().toUpperCase() : ''
  const name = typeof row.name === 'string' ? row.name.trim().replace(/\s+/g, ' ') : ''
  const basePrice = typeof row.basePrice === 'string' ? normalizeImportPrice(row.basePrice) : ''
  const stock = typeof row.stock === 'string' ? normalizeStock(row.stock) : ''
  const sourceRow = Number.isSafeInteger(row.sourceRow) && Number(row.sourceRow) > 0 ? Number(row.sourceRow) : index + 2
  const stockMode = row.stockMode === 'add' || row.stockMode === 'skip' ? row.stockMode : 'replace'
  const priceMode = row.priceMode === 'keep' ? row.priceMode : 'import'
  const nameMode: InventoryImportNameMode = row.nameMode === 'rename' || row.nameMode === 'new_code' ? row.nameMode : 'keep'
  const errors: string[] = []
  const basePriceCents = basePrice === '' ? null : parseBasePriceToCents(basePrice)
  const stockValue = stock === '' ? null : parseStock(stock)

  if (code !== '' && !CODE_PATTERN.test(code)) errors.push(MESSAGES.products.invalidCode)
  if (nameMode !== 'keep' && name.length === 0) errors.push(MESSAGES.products.nameRequired)
  if (name.length > MAX_NAME_LENGTH) errors.push(MESSAGES.products.nameTooLong)
  if (basePrice !== '' && basePriceCents === null) errors.push(MESSAGES.validation.invalidPrice)
  if (basePriceCents !== null && basePriceCents > MAX_BASE_PRICE_CENTS) errors.push(MESSAGES.validation.invalidPrice)
  if (stock !== '' && stockValue === null) errors.push(MESSAGES.validation.invalidStock)
  if (stockValue !== null && stockValue > MAX_STOCK) errors.push(MESSAGES.validation.invalidStock)

  return {
    sourceRow,
    code,
    name,
    basePrice,
    stock,
    stockMode,
    priceMode,
    nameMode,
    basePriceCents,
    stockValue,
    errors,
  }
}

const assertRowCount = (rows: unknown): unknown[] => {
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > MAX_IMPORT_ROWS) {
    throw new AppError(MESSAGES.inventoryImport.invalidRows(MAX_IMPORT_ROWS), 400)
  }
  return rows
}

const assertWarehouseActive = async (warehouseId: string): Promise<void> => {
  const warehouse = await WarehouseQuery.findById(warehouseId)
  if (!warehouse || warehouse.is_archived) throw new AppError(MESSAGES.warehouses.notFound, 404)
}

const mapState = (rows: NormalizedRow[], products: ProductRow[], inventory: ImportInventoryRow[]): InventoryImportPreviewRow[] => {
  const productByCode = new Map(products.map((product) => [product.code, product]))
  const inventoryByCode = new Map(inventory.map((item) => [item.product_code, item]))
  const counts = new Map<string, number>()
  for (const row of rows) {
    if (row.code !== '' && row.nameMode !== 'new_code' && row.stockMode !== 'skip') {
      counts.set(row.code, (counts.get(row.code) ?? 0) + 1)
    }
  }

  return rows.map((row) => {
    const existingProduct = row.code !== '' && row.nameMode !== 'new_code' ? productByCode.get(row.code) ?? null : null
    const existingInventory = row.code !== '' && row.nameMode !== 'new_code' ? inventoryByCode.get(row.code) ?? null : null
    const nameConflict = existingProduct !== null && row.name !== '' && normalizeProductName(row.name) !== normalizeProductName(existingProduct.name)
    const errors = row.stockMode === 'skip' ? [] : row.errors.slice()
    const effectiveName = row.nameMode === 'keep' && existingProduct ? existingProduct.name : row.name
    const hasEffectivePrice = row.priceMode === 'keep'
      ? existingInventory !== null
      : row.basePriceCents !== null
    const effectiveStock = row.stockMode === 'skip' ? 0 : row.stockValue

    if (row.stockMode !== 'skip') {
      if (effectiveName.trim() === '') errors.push(MESSAGES.products.nameRequired)
      if (!hasEffectivePrice) errors.push(MESSAGES.validation.invalidPrice)
      if (effectiveStock === null) errors.push(MESSAGES.validation.invalidStock)
      if (row.nameMode === 'rename' && !existingProduct) errors.push(MESSAGES.inventoryImport.renameMissingProduct)
      if (row.priceMode === 'keep' && !existingInventory) errors.push(MESSAGES.inventoryImport.keepPriceMissingProduct)
      if (row.code !== '' && counts.get(row.code) !== 1) errors.push(MESSAGES.inventoryImport.duplicateCodeInFile)
    }

    return {
      sourceRow: row.sourceRow,
      errors: Array.from(new Set(errors)),
      duplicateCodeInFile: row.code !== '' && (counts.get(row.code) ?? 0) > 1,
      nameConflict,
      existingProduct: existingProduct ? { code: existingProduct.code, name: existingProduct.name } : null,
      existingInventory: existingInventory
        ? {
            basePriceUsdCents: Math.round(Number(existingInventory.base_price_usd) * 100),
            stock: existingInventory.stock,
            isDeleted: existingInventory.deleted_at !== null,
          }
        : null,
    }
  })
}

const mapImportError = (error: unknown): never => {
  const message = getErrorMessage(error)
  if (message.includes('WAREHOUSE_NOT_FOUND')) throw new AppError(MESSAGES.warehouses.notFound, 404)
  if (message.includes('IMPORT_DUPLICATE_CODE')) throw new AppError(MESSAGES.inventoryImport.duplicateCodeInFile, 409)
  if (message.includes('PRODUCT_NAME_MISMATCH')) throw new AppError(MESSAGES.inventoryImport.nameConflictChoice, 409)
  if (message.includes('IMPORT_ROW_INVALID')) throw new AppError(MESSAGES.inventoryImport.importFailed, 400)
  throw error
}

export class ProductImportService {
  static async preview(warehouseId: string, value: unknown): Promise<InventoryImportPreview> {
    await requireRole(ADMIN_ROLES)
    await assertWarehouseActive(warehouseId)
    const rows = assertRowCount(value)
    const normalized = rows.map(normalizeRow)
    const codes = Array.from(new Set(normalized
      .filter((row) => row.code !== '' && row.nameMode !== 'new_code')
      .map((row) => row.code)))
    const state = await ProductQuery.findImportState(warehouseId, codes)
    return { rows: mapState(normalized, state.products, state.inventory) }
  }

  static async import(warehouseId: string, value: unknown): Promise<InventoryImportResult> {
    const actor = await requireRole(ADMIN_ROLES)
    await assertWarehouseActive(warehouseId)
    const rows = assertRowCount(value).map(normalizeRow)
    const activeRows = rows.filter((row) => row.stockMode !== 'skip')
    if (activeRows.length === 0) throw new AppError(MESSAGES.inventoryImport.nothingToImport, 400)

    const codes = Array.from(new Set(activeRows
      .filter((row) => row.code !== '' && row.nameMode !== 'new_code')
      .map((row) => row.code)))
    const state = await ProductQuery.findImportState(warehouseId, codes)
    const productByCode = new Map(state.products.map((product) => [product.code, product]))
    const inventoryByCode = new Map(state.inventory.map((item) => [item.product_code, item]))
    const importRows: InventoryImportRpcRow[] = activeRows.map((row) => {
      const existingProduct = row.code === '' || row.nameMode === 'new_code' ? null : productByCode.get(row.code) ?? null
      const existingInventory = row.code === '' || row.nameMode === 'new_code' ? null : inventoryByCode.get(row.code) ?? null
      const name = row.nameMode === 'keep' && existingProduct ? existingProduct.name : row.name
      const basePriceCents = row.priceMode === 'keep' && existingInventory
        ? Math.round(Number(existingInventory.base_price_usd) * 100)
        : row.basePriceCents

      if (row.errors.length > 0 || name === '' || basePriceCents === null || row.stockValue === null) {
        throw new AppError(MESSAGES.inventoryImport.correctRows, 400)
      }
      if (row.nameMode === 'rename' && !existingProduct) throw new AppError(MESSAGES.inventoryImport.renameMissingProduct, 400)
      if (row.priceMode === 'keep' && !existingInventory) throw new AppError(MESSAGES.inventoryImport.keepPriceMissingProduct, 400)
      return {
        code: row.nameMode === 'new_code' ? null : row.code || null,
        name,
        base_price_usd: (basePriceCents / 100).toFixed(2),
        stock: row.stockValue,
        stock_mode: row.stockMode,
        price_mode: row.priceMode,
        name_mode: row.nameMode,
      }
    })

    const seenCodes = new Set<string>()
    for (const row of importRows) {
      if (row.code === null) continue
      if (seenCodes.has(row.code)) throw new AppError(MESSAGES.inventoryImport.duplicateCodeInFile, 409)
      seenCodes.add(row.code)
    }

    try {
      const codes = await ProductQuery.importInventory(warehouseId, actor.id, importRows)
      return { imported: codes.length, skipped: rows.length - activeRows.length, codes }
    } catch (error) {
      return mapImportError(error)
    }
  }
}
