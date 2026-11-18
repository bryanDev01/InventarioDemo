import type { ReactElement } from 'react'
import AccessDenied from '@/components/Common/AccessDenied'
import PosTerminal from '@/components/Pos/PosTerminal'
import { requireUser } from '@/lib/auth'
import { ROLES } from '@/lib/constants'
import { PosService } from '@/lib/services/PosService'

export default async function PosContent(): Promise<ReactElement> {
  const user = await requireUser()
  if (user.role !== ROLES.ADMIN && user.role !== ROLES.INVOICER) return <AccessDenied />
  const catalog = await PosService.catalog(user, null)
  return <PosTerminal initial={catalog} />
}
