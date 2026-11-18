export type InventoryImportFormat = 'xlsx' | 'pdf' | 'docx'
export type InventoryImportStockMode = 'replace' | 'add' | 'skip'
export type InventoryImportPriceMode = 'import' | 'keep'
export type InventoryImportNameMode = 'keep' | 'rename' | 'new_code'

export interface ParsedInventoryFile {
  format: InventoryImportFormat
  sheetName: string | null
  headers: string[]
  rows: string[][]
}

export interface InventoryImportRow {
  sourceRow: number
  code: string
  name: string
  basePrice: string
  stock: string
  stockMode: InventoryImportStockMode
  priceMode: InventoryImportPriceMode
  nameMode: InventoryImportNameMode
}

export interface InventoryImportExistingProduct {
  code: string
  name: string
}

export interface InventoryImportExistingInventory {
  basePriceUsdCents: number
  stock: number
  isDeleted: boolean
}

export interface InventoryImportPreviewRow {
  sourceRow: number
  errors: string[]
  duplicateCodeInFile: boolean
  nameConflict: boolean
  existingProduct: InventoryImportExistingProduct | null
  existingInventory: InventoryImportExistingInventory | null
}

export interface InventoryImportPreview {
  rows: InventoryImportPreviewRow[]
}

export interface InventoryImportResult {
  imported: number
  skipped: number
  codes: string[]
}

export interface InventoryImportRpcRow {
  [key: string]: string | number | null
  code: string | null
  name: string
  base_price_usd: string
  stock: number
  stock_mode: InventoryImportStockMode
  price_mode: InventoryImportPriceMode
  name_mode: InventoryImportNameMode
}
