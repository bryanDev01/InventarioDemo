const MAX_PREFIX_LENGTH = 8

export const buildWarehouseIdPrefix = (name: string): string | null => {
  const letters = name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
  if (letters === '') return null
  return letters.slice(0, MAX_PREFIX_LENGTH)
}

export const buildWarehouseId = (prefix: string, existingIds: string[]): string => {
  const pattern = new RegExp(`^${prefix}(\\d+)$`)
  const highest = existingIds.reduce((max, id) => {
    const match = pattern.exec(id)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)
  return `${prefix}${highest + 1}`
}
