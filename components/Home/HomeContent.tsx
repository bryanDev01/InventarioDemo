import Link from 'next/link'
import type { ReactElement } from 'react'
import SoldProductsReport from '@/components/Reports/SoldProductsReport'
import { requireUser } from '@/lib/auth'
import { ROLES } from '@/lib/constants'
import { MESSAGES } from '@/lib/messages'

interface HomeContentProps {
  searchParams: Promise<Record<string, string | undefined>>
}

export default async function HomeContent({ searchParams }: HomeContentProps): Promise<ReactElement> {
  const params = await searchParams
  const user = await requireUser()

  if (user.role === ROLES.ADMIN) {
    return (
      <SoldProductsReport
        actor={user}
        filters={{
          from: params.from,
          to: params.to,
          warehouseId: params.warehouseId,
        }}
      />
    )
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-ivory-dark bg-ivory p-5 sm:p-8">
      <h1 className="text-2xl font-semibold text-black">{`${MESSAGES.ui.home.welcome}, ${user.username}`}</h1>
      <Link href="/reports" className="w-fit rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:bg-gold-hover">
        {MESSAGES.ui.nav.reports}
      </Link>
    </section>
  )
}
