'use client'

import { useState } from 'react'
import type { FormEvent, ReactElement } from 'react'
import { apiRequest } from '@/lib/apiClient'
import { MESSAGES } from '@/lib/messages'
import { isValidUsername, normalizeUsername } from '@/lib/validators'
import type { RoleName } from '@/lib/constants'
import type { CreateUserPayload, UpdateUserPayload, UserRecord } from '@/types/user'
import type { WarehouseOption } from '@/types/warehouse'

interface RoleOption {
  name: RoleName
  label: string
}

interface UserFormProps {
  roles: RoleOption[]
  warehouses: WarehouseOption[]
  user: UserRecord | null
  isSelf: boolean
  onSaved: () => void
  onCancel: () => void
}

export default function UserForm({ roles, warehouses, user, isSelf, onSaved, onCancel }: UserFormProps): ReactElement {
  const isEdit = user !== null
  const [username, setUsername] = useState<string>(user?.username ?? '')
  const [password, setPassword] = useState<string>('')
  const [role, setRole] = useState<RoleName>(user?.role ?? roles[0]?.name ?? 'invoicer')
  const [warehouseIds, setWarehouseIds] = useState<string[]>(user?.warehouses.map((warehouse) => warehouse.id) ?? [])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const toggleWarehouse = (id: string): void => {
    setWarehouseIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (loading) return
    setError(null)

    if (!isValidUsername(username)) {
      setError(MESSAGES.validation.invalidUsername)
      return
    }
    if (!isEdit && password === '') {
      setError(MESSAGES.users.passwordRequired)
      return
    }

    setLoading(true)
    try {
      if (isEdit && user) {
        const payload: UpdateUserPayload = { username: normalizeUsername(username), role, warehouseIds }
        if (password !== '') payload.password = password
        await apiRequest<UserRecord>(`/api/users/${user.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
      } else {
        const payload: CreateUserPayload = { username: normalizeUsername(username), password, role, warehouseIds }
        await apiRequest<UserRecord>('/api/users', { method: 'POST', body: JSON.stringify(payload) })
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : MESSAGES.common.unexpectedError)
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {isSelf && (
        <p className="rounded-md border border-gold bg-ivory-dark px-3 py-2 text-xs font-normal text-black/75">
          {MESSAGES.ui.users.ownAccountProtected}
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm font-medium text-black/75">
        {MESSAGES.ui.users.columns.username}
        <input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoCapitalize="none"
          required
          disabled={isSelf}
          className="rounded-md border border-ivory-dark px-3 py-2 font-normal focus:border-gold focus:outline-none disabled:bg-ivory-dark disabled:text-black/60"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-black/75">
        {MESSAGES.ui.login.password}
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          required={!isEdit}
          className="rounded-md border border-ivory-dark px-3 py-2 font-normal focus:border-gold focus:outline-none"
        />
        {isEdit && <span className="text-xs font-normal text-black/60">{MESSAGES.ui.users.passwordKeep}</span>}
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-black/75">
        {MESSAGES.ui.users.role}
        <select
          value={role}
          onChange={(event) => setRole(event.target.value as RoleName)}
          disabled={isSelf}
          className="rounded-md border border-ivory-dark bg-ivory px-3 py-2 font-normal focus:border-gold focus:outline-none disabled:bg-ivory-dark disabled:text-black/60"
        >
          {roles.map((option) => (
            <option key={option.name} value={option.name}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <fieldset disabled={isSelf} className="flex flex-col gap-2 text-sm font-medium text-black/75 disabled:opacity-60">
        <legend className="mb-1">{MESSAGES.ui.users.columns.warehouses}</legend>
        {warehouses.length === 0 && <span className="text-xs font-normal text-black/60">{MESSAGES.ui.warehouses.empty}</span>}
        {warehouses.map((warehouse) => (
          <label key={warehouse.id} className="flex items-center gap-2 font-normal">
            <input type="checkbox" checked={warehouseIds.includes(warehouse.id)} onChange={() => toggleWarehouse(warehouse.id)} />
            {warehouse.name}
          </label>
        ))}
      </fieldset>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
        <button type="button" onClick={onCancel} disabled={loading} className="min-h-11 w-full rounded-md border border-ivory-dark px-4 py-2 text-sm hover:bg-ivory-dark disabled:opacity-50 sm:w-auto">
          {MESSAGES.common.cancel}
        </button>
        <button type="submit" disabled={loading || (isSelf && password === '')} className="min-h-11 w-full rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:bg-gold-hover disabled:opacity-50 sm:w-auto">
          {loading ? MESSAGES.common.saving : MESSAGES.common.save}
        </button>
      </div>
    </form>
  )
}
