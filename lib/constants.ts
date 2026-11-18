export const APP_TIMEZONE = 'America/Havana'

export const ROLES = {
  ADMIN: 'admin',
  INVOICER: 'invoicer',
  SELLER: 'seller',
} as const

export type RoleName = (typeof ROLES)[keyof typeof ROLES]

export const PAYMENT_METHODS = {
  CASH: 'cash',
  TRANSFER: 'transfer',
} as const

export type PaymentMethod = (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS]

export const MOVEMENT_TYPES = {
  ENTRY: 'entry',
  EXIT: 'exit',
  TRANSFER: 'transfer',
  ADJUSTMENT: 'adjustment',
  INVOICE_EXIT: 'invoice_exit',
} as const

export type MovementType = (typeof MOVEMENT_TYPES)[keyof typeof MOVEMENT_TYPES]

export const INVOICE_STATUSES = {
  VALID: 'valid',
  MODIFIED: 'modified',
  DELETED: 'deleted',
} as const

export type InvoiceStatus = (typeof INVOICE_STATUSES)[keyof typeof INVOICE_STATUSES]

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'Inventaria'

export const INTERNAL_EMAIL_DOMAIN = 'inventaria.invalid'

export const CI_LENGTH = 11
export const PLATE_LENGTH = 7
export const PRODUCT_CODE_PREFIX = 'PRD-'
