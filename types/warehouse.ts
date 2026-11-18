export interface WarehouseOption {
  id: string
  name: string
}

export interface WarehouseStaff {
  id: string
  username: string
}

export interface WarehouseRecord extends WarehouseOption {
  location: string | null
  staff: WarehouseStaff[]
  productCount: number
  totalStock: number
  createdAt: string
}

export interface CreateWarehousePayload {
  name: string
  location?: string | null
}

export interface UpdateWarehousePayload {
  name?: string
  location?: string | null
}

export interface UpdateWarehouseStaffPayload {
  userIds: string[]
}
