import type { InventoryImportRow } from '@/types/inventoryImport'

export type InventoryImportField = 'code' | 'name' | 'basePrice' | 'stock'

export type InventoryImportMapping = Record<InventoryImportField, number | null>

const HEADER_ALIASES: Record<InventoryImportField, readonly string[]> = {
  code: ['codigo', 'cod producto', 'codigo producto', 'product code', 'productcode', 'item code', 'sku'],
  name: ['nombre', 'producto', 'nombre producto', 'nombre del producto', 'descripcion', 'descripcion del producto', 'description', 'product name', 'name', 'articulo'],
  basePrice: ['precio base usd', 'precio base', 'precio usd', 'base price usd', 'base price', 'price usd', 'costo usd'],
  stock: ['stock', 'existencia', 'existencias', 'stock actual', 'cantidad', 'unidades', 'quantity', 'qty', 'inventory'],
}

export const IMPORT_FIELD_LABELS: Record<InventoryImportField, string> = {
  code: 'Código',
  name: 'Nombre',
  basePrice: 'Precio base (USD)',
  stock: 'Stock',
}

export const normalizeImportHeader = (value: string): string => value
  .normalize('NFD')
  .replace(/\p{M}/gu, '')
  .toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim()

export const suggestInventoryImportMapping = (headers: string[]): InventoryImportMapping => {
  const mapping: InventoryImportMapping = { code: null, name: null, basePrice: null, stock: null }
  const normalizedHeaders = headers.map(normalizeImportHeader)

  for (const field of Object.keys(HEADER_ALIASES) as InventoryImportField[]) {
    const aliases = HEADER_ALIASES[field].map(normalizeImportHeader)
    const match = normalizedHeaders.findIndex((header) => aliases.includes(header))
    if (match !== -1 && !Object.values(mapping).includes(match)) mapping[field] = match
  }

  return mapping
}

export const recognizedInventoryImportHeaders = (headers: string[]): number => {
  const mapping = suggestInventoryImportMapping(headers)
  return Object.values(mapping).filter((index) => index !== null).length
}

export const createInventoryImportRows = (
  rows: string[][],
  mapping: InventoryImportMapping,
): InventoryImportRow[] => rows.map((cells, index): InventoryImportRow => ({
  sourceRow: index + 1,
  code: mappedCell(cells, mapping.code).trim().toUpperCase(),
  name: mappedCell(cells, mapping.name).trim(),
  basePrice: mappedCell(cells, mapping.basePrice).trim(),
  stock: mappedCell(cells, mapping.stock).trim(),
  stockMode: 'replace',
  priceMode: 'import',
  nameMode: 'keep',
})).filter((row) => row.code !== '' || row.name !== '' || row.basePrice !== '' || row.stock !== '')

const mappedCell = (cells: string[], columnIndex: number | null): string =>
  columnIndex === null ? '' : cells[columnIndex] ?? ''

export const isInventoryImportField = (value: string): value is InventoryImportField =>
  value === 'code' || value === 'name' || value === 'basePrice' || value === 'stock'

export const getImportHeaderLabel = (headers: string[], index: number): string =>
  headers[index]?.trim() || `Columna ${index + 1}`
