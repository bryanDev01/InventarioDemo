import { CI_LENGTH, INTERNAL_EMAIL_DOMAIN, PLATE_LENGTH } from '@/lib/constants'
import { parseDecimalToCents } from '@/lib/money'

const CI_PATTERN = new RegExp(`^\\d{${CI_LENGTH}}$`)
const PLATE_PATTERN = new RegExp(`^[A-Z]\\d{${PLATE_LENGTH - 1}}$`)
const USERNAME_PATTERN = /^[a-z0-9._-]+$/
const QUANTITY_PATTERN = /^\d+$/

export const normalizeUsername = (value: string): string => value.trim().toLowerCase()

export const isValidUsername = (value: string): boolean => USERNAME_PATTERN.test(normalizeUsername(value))

export const buildInternalEmail = (username: string): string =>
  `${normalizeUsername(username)}@${INTERNAL_EMAIL_DOMAIN}`

export const isValidCi = (value: string): boolean => CI_PATTERN.test(value)

export const isValidClientName = (value: string): boolean => {
  const normalized = value.trim().replace(/\s+/g, ' ')
  return normalized.length > 0 && normalized.length <= 120
}

export const normalizePlate = (value: string): string => value.trim().toUpperCase()

export const isValidPlate = (value: string): boolean => PLATE_PATTERN.test(normalizePlate(value))

export const parseQuantity = (value: string): number | null => {
  const trimmed = value.trim()
  if (!QUANTITY_PATTERN.test(trimmed)) return null
  const quantity = Number(trimmed)
  return quantity > 0 && Number.isSafeInteger(quantity) ? quantity : null
}

export const parseStock = (value: string): number | null => {
  const trimmed = value.trim()
  if (!QUANTITY_PATTERN.test(trimmed)) return null
  const stock = Number(trimmed)
  return Number.isSafeInteger(stock) ? stock : null
}

export const parseBasePriceToCents = (value: string): number | null => {
  const cents = parseDecimalToCents(value)
  return cents !== null && cents > 0 ? cents : null
}
