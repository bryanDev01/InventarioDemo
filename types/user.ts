import type { RoleName } from '@/lib/constants'
import type { WarehouseOption } from '@/types/warehouse'

export interface AuthUser {
  id: string
  username: string
  role: RoleName
  isActive: boolean
  warehouses: WarehouseOption[]
}

export interface UserRecord {
  id: string
  username: string
  role: RoleName
  roleLabel: string
  isActive: boolean
  createdAt: string
  warehouses: WarehouseOption[]
}

export interface CreateUserPayload {
  username: string
  password: string
  role: RoleName
  warehouseIds?: string[]
}

export interface UpdateUserPayload {
  username?: string
  password?: string
  role?: RoleName
  isActive?: boolean
  warehouseIds?: string[]
}
