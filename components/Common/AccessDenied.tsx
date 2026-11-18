import type { ReactElement } from 'react'
import { MESSAGES } from '@/lib/messages'

export default function AccessDenied(): ReactElement {
  return (
    <div className="rounded-lg border border-ivory-dark bg-ivory p-6 text-center sm:p-10">
      <h1 className="text-xl font-semibold text-black">{MESSAGES.ui.accessDenied.title}</h1>
      <p className="mt-2 text-sm text-black/75">{MESSAGES.ui.accessDenied.description}</p>
    </div>
  )
}
