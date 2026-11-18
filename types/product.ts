export interface ProductRecord {
  code: string
  name: string
  basePriceUsdCents: number
  stock: number
}

export interface RegisterProductPayload {
  code?: string | null
  name: string
  basePrice: string
  stock: string
}

export interface UpdateInventoryPayload {
  name?: string
  basePrice?: string
  stock?: string
  observation?: string | null
}
