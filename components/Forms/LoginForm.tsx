'use client'

import { useState } from 'react'
import type { FormEvent, ReactElement } from 'react'
import { apiRequest } from '@/lib/apiClient'
import { MESSAGES } from '@/lib/messages'
import type { AuthUser } from '@/types/user'

export default function LoginForm(): ReactElement {
  const [username, setUsername] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [showPassword, setShowPassword] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (loading) return
    setError(null)
    setLoading(true)
    try {
      await apiRequest<AuthUser>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      })
      // Full reload so the server reads the new session cookie before rendering the shell.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign('/home')
    } catch (err) {
      setError(err instanceof Error ? err.message : MESSAGES.common.unexpectedError)
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium text-black/75">
        {MESSAGES.ui.login.username}
        <input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          required
          className="rounded-md border border-ivory-dark px-3 py-2 font-normal focus:border-gold focus:outline-none"
        />
      </label>
      <div className="flex flex-col gap-1 text-sm font-medium text-black/75">
        <label htmlFor="login-password">{MESSAGES.ui.login.password}</label>
        <div className="relative">
          <input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
            className="w-full rounded-md border border-ivory-dark px-3 py-2 pr-11 font-normal focus:border-gold focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            aria-label={showPassword ? MESSAGES.ui.login.hidePassword : MESSAGES.ui.login.showPassword}
            aria-pressed={showPassword}
            title={showPassword ? MESSAGES.ui.login.hidePassword : MESSAGES.ui.login.showPassword}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-black/60 hover:text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold"
          >
            {showPassword ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
                <path d="m3 3 18 18" />
                <path d="M10.6 10.6a3 3 0 0 0 4.2 4.2" />
                <path d="M9.9 5.2A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-4.2 4.6" />
                <path d="M6.4 6.4C3.6 8.3 2 12 2 12s3.5 7 10 7a10.7 10.7 0 0 0 5.6-1.6" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:bg-gold-hover disabled:opacity-50"
      >
        {loading ? MESSAGES.ui.login.submitting : MESSAGES.ui.login.submit}
      </button>
    </form>
  )
}
