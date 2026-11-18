import type { ReactElement } from 'react'
import AccessDenied from '@/components/Common/AccessDenied'
import WarehousesTable from '@/components/Warehouses/WarehousesTable'
import { requireUser } from '@/lib/auth'
import { ROLES } from '@/lib/constants'
import { WarehouseService } from '@/lib/services/WarehouseService'

export default async function WarehousesContent(): Promise<ReactElement> {
  const user = await requireUser()
  if (user.role !== ROLES.ADMIN) return <AccessDenied />

  const [warehouses, staffCandidates] = await Promise.all([
    WarehouseService.list(),
    WarehouseService.listStaffCandidates(),
  ])
  return <WarehousesTable warehouses={warehouses} staffCandidates={staffCandidates} />
}
