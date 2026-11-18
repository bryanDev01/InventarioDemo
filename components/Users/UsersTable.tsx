'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { ReactElement } from 'react'
import ConfirmDialog from '@/components/Common/ConfirmDialog'
import Modal from '@/components/Common/Modal'
import UserForm from '@/components/Forms/UserForm'
import { apiRequest } from '@/lib/apiClient'
import { MESSAGES } from '@/lib/messages'
import { ROLES } from '@/lib/constants'
import type { RoleName } from '@/lib/constants'
import type { UpdateUserPayload, UserRecord } from '@/types/user'
import type { WarehouseOption } from '@/types/warehouse'

interface RoleOption {
  name: RoleName
  label: string
}

interface UsersTableProps {
  users: UserRecord[]
  roles: RoleOption[]
  warehouses: WarehouseOption[]
  currentUserId: string
}

type PendingAction =
  | { kind: 'toggle'; user: UserRecord }
  | { kind: 'delete'; user: UserRecord }

export default function UsersTable({ users, roles, warehouses, currentUserId }: UsersTableProps): ReactElement {
  const router = useRouter()
  const [formUser, setFormUser] = useState<UserRecord | null>(null)
  const [formOpen, setFormOpen] = useState<boolean>(false)
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [busy, setBusy] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const openCreate = (): void => {
    setFormUser(null)
    setFormOpen(true)
  }

  const openEdit = (user: UserRecord): void => {
    setFormUser(user)
    setFormOpen(true)
  }

  const closeForm = (): void => {
    setFormOpen(false)
    setFormUser(null)
  }

  const handleSaved = (): void => {
    closeForm()
    router.refresh()
  }

  const runPendingAction = async (): Promise<void> => {
    if (!pending) return
    setBusy(true)
    setError(null)
    try {
      if (pending.kind === 'toggle') {
        const payload: UpdateUserPayload = { isActive: !pending.user.isActive }
        await apiRequest<UserRecord>(`/api/users/${pending.user.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
      } else {
        await apiRequest<never>(`/api/users/${pending.user.id}`, { method: 'DELETE' })
      }
      setPending(null)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : MESSAGES.common.unexpectedError)
    } finally {
      setBusy(false)
    }
  }

  const confirmTitle = pending?.kind === 'delete'
    ? MESSAGES.ui.users.deleteTitle
    : pending?.user.isActive
      ? MESSAGES.common.deactivate
      : MESSAGES.common.activate

  const confirmMessage = pending?.kind === 'delete'
    ? MESSAGES.ui.users.deleteConfirm(pending.user.username)
    : pending
      ? MESSAGES.ui.users.toggleConfirm(pending.user.username, !pending.user.isActive)
      : ''

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-black sm:text-2xl">{MESSAGES.ui.users.title}</h1>
        <button type="button" onClick={openCreate} className="min-h-11 w-full rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:bg-gold-hover sm:w-auto">
          {MESSAGES.ui.users.newUser}
        </button>
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-ivory-dark bg-ivory">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-ivory-dark bg-ivory text-black/75">
            <tr>
              <th className="px-4 py-3 font-medium">{MESSAGES.ui.users.columns.username}</th>
              <th className="px-4 py-3 font-medium">{MESSAGES.ui.users.columns.role}</th>
              <th className="px-4 py-3 font-medium">{MESSAGES.ui.users.columns.status}</th>
              <th className="px-4 py-3 font-medium">{MESSAGES.ui.users.columns.warehouses}</th>
              <th className="px-4 py-3 font-medium">{MESSAGES.ui.users.columns.actions}</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-black/60">{MESSAGES.ui.users.empty}</td>
              </tr>
            )}
            {users.map((user) => {
              const isSelf = user.id === currentUserId
              return (
                <tr key={user.id} className="border-b border-ivory-dark last:border-0">
                  <td className="px-4 py-3 font-medium text-black">{user.username}</td>
                  <td className="px-4 py-3 text-black/75">{user.roleLabel}</td>
                  <td className="px-4 py-3">
                    <span className={user.isActive ? 'text-green-700' : 'text-black/60'}>
                      {user.isActive ? MESSAGES.common.active : MESSAGES.common.inactive}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-black/75">
                    {user.role === ROLES.ADMIN
                      ? MESSAGES.ui.header.allWarehouses
                      : user.warehouses.length > 0
                        ? user.warehouses.map((warehouse) => warehouse.name).join(', ')
                        : MESSAGES.ui.header.noWarehouses}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => openEdit(user)} className="min-h-11 rounded-md border border-ivory-dark px-3 py-2 hover:bg-ivory-dark">
                        {MESSAGES.common.edit}
                      </button>
                      <button
                        type="button"
                        disabled={isSelf}
                        onClick={() => setPending({ kind: 'toggle', user })}
                        className="min-h-11 rounded-md border border-ivory-dark px-3 py-2 hover:bg-ivory-dark disabled:opacity-40"
                      >
                        {user.isActive ? MESSAGES.common.deactivate : MESSAGES.common.activate}
                      </button>
                      <button
                        type="button"
                        disabled={isSelf}
                        onClick={() => setPending({ kind: 'delete', user })}
                        className="min-h-11 rounded-md border border-red-300 px-3 py-2 text-red-700 hover:bg-red-50 disabled:opacity-40"
                      >
                        {MESSAGES.common.delete}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {formOpen && (
        <Modal title={formUser ? MESSAGES.ui.users.editTitle : MESSAGES.ui.users.createTitle} onClose={closeForm}>
          <UserForm roles={roles} warehouses={warehouses} user={formUser} isSelf={formUser?.id === currentUserId} onSaved={handleSaved} onCancel={closeForm} />
        </Modal>
      )}

      {pending && (
        <ConfirmDialog
          title={confirmTitle}
          message={confirmMessage}
          confirmLabel={confirmTitle}
          busy={busy}
          onConfirm={runPendingAction}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  )
}
