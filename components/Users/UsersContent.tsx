import type { ReactElement } from 'react'
import AccessDenied from '@/components/Common/AccessDenied'
import UsersTable from '@/components/Users/UsersTable'
import { requireUser } from '@/lib/auth'
import { ROLES } from '@/lib/constants'
import { UsersQuery } from '@/lib/queries/users'
import { UserService } from '@/lib/services/UserService'
import { WarehouseService } from '@/lib/services/WarehouseService'

export default async function UsersContent(): Promise<ReactElement> {
  const user = await requireUser()
  if (user.role !== ROLES.ADMIN) return <AccessDenied />

  const [users, roles, warehouses] = await Promise.all([
    UserService.list(),
    UsersQuery.listRoles(),
    WarehouseService.listOptions(),
  ])
  return <UsersTable users={users} roles={roles} warehouses={warehouses} currentUserId={user.id} />
}
