import Image from 'next/image'
import { redirect } from 'next/navigation'
import type { ReactElement } from 'react'
import LoginForm from '@/components/Forms/LoginForm'
import { APP_NAME } from '@/lib/constants'
import { getCurrentUser } from '@/lib/auth'
import { MESSAGES } from '@/lib/messages'

export default async function LoginContent(): Promise<ReactElement> {
  const user = await getCurrentUser()
  if (user) redirect('/home')

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-6">
      <h1>
        <Image
          src="/logo.svg"
          alt={APP_NAME}
          width={400}
          height={120}
          priority
          className="h-24 w-auto"
        />
      </h1>
      <div className="w-full rounded-lg border-t-4 border-gold bg-ivory p-5 shadow-lg sm:p-8">
        <h2 className="mb-6 text-sm text-black/75">{MESSAGES.ui.login.title}</h2>
        <LoginForm />
      </div>
      <p className="w-full rounded-lg border border-gold/50 bg-black/60 px-4 py-3 text-center text-xs text-ivory/90 sm:text-sm">
        <strong className="text-gold">{MESSAGES.ui.login.demoNotice}</strong>
        {' · '}
        {MESSAGES.ui.login.demoCredentials}:{' '}
        <code className="font-mono">{MESSAGES.ui.login.demoAdmin}</code> /{' '}
        <code className="font-mono">{MESSAGES.ui.login.demoPassword}</code>{' · '}
        <code className="font-mono">{MESSAGES.ui.login.demoInvoicer}</code> /{' '}
        <code className="font-mono">{MESSAGES.ui.login.demoPassword}</code>
      </p>
    </div>
  )
}
