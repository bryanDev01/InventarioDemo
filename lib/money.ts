const CENTS_PER_UNIT = 100
const RATE_DECIMALS = 2
const MONEY_DECIMALS = 2

const DECIMAL_PATTERN = /^\d+(\.\d+)?$/

export const parseDecimalToCents = (value: string, maxDecimals: number = MONEY_DECIMALS): number | null => {
  const trimmed = value.trim()
  if (!DECIMAL_PATTERN.test(trimmed)) return null
  const [whole, fraction = ''] = trimmed.split('.')
  if (fraction.length > maxDecimals) return null
  const cents = Number(whole) * CENTS_PER_UNIT + Number(fraction.padEnd(MONEY_DECIMALS, '0'))
  return Number.isSafeInteger(cents) ? cents : null
}

export const parseRateToCents = (value: string): number | null => {
  const cents = parseDecimalToCents(value, RATE_DECIMALS)
  return cents !== null && cents > 0 ? cents : null
}

export const roundHalfUpDivide = (numerator: number, denominator: number): number => {
  if (numerator < 0 || denominator <= 0) throw new RangeError('roundHalfUpDivide expects a non-negative numerator and a positive denominator')
  return Math.floor((2 * numerator + denominator) / (2 * denominator))
}

export const calculateUnitPriceCupCents = (basePriceUsdCents: number, rateCents: number): number =>
  roundHalfUpDivide(basePriceUsdCents * rateCents, CENTS_PER_UNIT)

export const calculateLineSubtotalCupCents = (quantity: number, unitPriceCupCents: number): number =>
  quantity * unitPriceCupCents

export const convertCupCentsToUsdCents = (amountCupCents: number, rateCents: number): number =>
  roundHalfUpDivide(amountCupCents * CENTS_PER_UNIT, rateCents)

export const formatCents = (cents: number): string => {
  const sign = cents < 0 ? '-' : ''
  const absolute = Math.abs(cents)
  const whole = Math.floor(absolute / CENTS_PER_UNIT)
  const fraction = String(absolute % CENTS_PER_UNIT).padStart(MONEY_DECIMALS, '0')
  const wholeGrouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${sign}${wholeGrouped}.${fraction}`
}
