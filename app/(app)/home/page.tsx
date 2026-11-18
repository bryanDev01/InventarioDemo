import { Suspense } from 'react'
import type { ReactElement } from 'react'
import HomeContent from '@/components/Home/HomeContent'

interface HomePageProps {
  searchParams: Promise<Record<string, string | undefined>>
}

export default function HomePage({ searchParams }: HomePageProps): ReactElement {
  return (
    <Suspense fallback={<div className="min-h-[40vh] rounded-lg bg-ivory/20" />}>
      <HomeContent searchParams={searchParams} />
    </Suspense>
  )
}
