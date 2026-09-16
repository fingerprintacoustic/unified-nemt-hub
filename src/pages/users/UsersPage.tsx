import { useEffect, useMemo, useState } from 'react'
import { ShieldCheck, UserCog, UserX } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { hasMinimumRole } from '../../config/roles'
import { useAuth } from '../../context/AuthContext'
import { toUserMessage } from '../../lib/errors'
import { formatRole } from '../../lib/format'
import { observeOrgUsers, setUserStatus, updateUserRole } from '../../services/users'
import type { UserRecord, UserRole, UserStatus } from '../../types'

const ROLE_OPTIONS: UserRole[] = ['ADMIN', 'MANAGER', 'DISPATCHER', 'DRIVER']

const roleBadgeTone: Record<UserRole, 'violet' | 'blue' | 'green' | 'neutral'> = {
  ADMIN: 'violet',
  MANAGER: 'blue',
  DISPATCHER: 'green',
  DRIVER: 'neutral',
}

export function UsersPage() {
  const { userRecord } = useAuth()
  const organizationId = userRecord?.organizationId
  const canChangeRole = userRecord?.role === 'ADMIN'
  const canChangeStatus = hasMinimumRole(userRecord?.role, 'MANAGER')

  const [users, setUsers] = useState<UserRecord[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  // Per-row in-flight uid, so only the row being changed shows a spinner.
  const [pendingUid, setPendingUid] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (!organizationId) return
    const unsubscribe = observeOrgUsers(
      organizationId,
      (records) => {
        setUsers(records)
        setLoadError(null)
      },
      (error) => setLoadError(toUserMessage(error, 'Could not load users for your organization.')),
    )
    return unsubscribe
  }, [organizationId])

  const seedCommand = useMemo(() => {
    if (!organizationId) return ''
    return `node create-user.mjs --org-id ${organizationId} --email "new.user@example.com" --first-name "First" --last-name "Last" --role DISPATCHER`
  }, [organizationId])

  async function handleRoleChange(uid: string, role: UserRole) {
    setActionError(null)
    setPendingUid(uid)
    try {
      await updateUserRole(uid, role)
    } catch (error) {
      setActionError(toUserMessage(error, 'Could not update that user’s role.'))
    } finally {
      setPendingUid(null)
    }
  }

  async function handleStatusToggle(uid: string, currentStatus: UserStatus) {
    const next: UserStatus = currentStatus === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'
    setActionError(null)
    setPendingUid(uid)
    try {
      await setUserStatus(uid, next)
    } catch (error) {
      setActionError(toUserMessage(error, 'Could not update that user’s status.'))
    } finally {
      setPendingUid(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Users"
        description="Manage staff and driver accounts in your organization: roles and active status."
      />

      {actionError && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{actionError}</p>
      )}

      <div className="mt-6">
        <Card title="Organization members" subtitle={users ? `${users.length} user${users.length === 1 ? '' : 's'}` : undefined}>
          {loadError ? (
            <p className="text-sm text-red-600">{loadError}</p>
          ) : users === null ? (
            <p className="text-sm text-slate-500">Loading users…</p>
          ) : users.length === 0 ? (
            <EmptyState
              icon={UserCog}
              title="No users found"
              description="This organization has no user records yet."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-medium uppercase tracking-wide text-slate-400">
                    <th className="pb-3 pr-4">Name</th>
                    <th className="pb-3 pr-4">Email</th>
                    <th className="pb-3 pr-4">Role</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((row) => {
                    const isSelf = row.uid === userRecord?.uid
                    const isPending = pendingUid === row.uid
                    return (
                      <tr key={row.uid}>
                        <td className="py-3 pr-4 font-medium text-slate-800">
                          {row.firstName} {row.lastName}
                          {isSelf && <span className="ml-2 text-xs font-normal text-slate-400">(you)</span>}
                        </td>
                        <td className="py-3 pr-4 text-slate-500">{row.email}</td>
                        <td className="py-3 pr-4">
                          {canChangeRole && !isSelf ? (
                            <select
                              value={row.role}
                              disabled={isPending}
                              onChange={(event) => handleRoleChange(row.uid, event.target.value as UserRole)}
                              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700 focus:border-blue-500 focus:outline-none disabled:opacity-60"
                            >
                              {ROLE_OPTIONS.map((role) => (
                                <option key={role} value={role}>
                                  {formatRole(role)}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <Badge tone={roleBadgeTone[row.role]}>{formatRole(row.role)}</Badge>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge tone={row.status === 'ACTIVE' ? 'green' : row.status === 'PENDING' ? 'amber' : 'red'}>
                            {row.status}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4 text-right">
                          {canChangeStatus && !isSelf ? (
                            <Button
                              variant={row.status === 'ACTIVE' ? 'danger' : 'secondary'}
                              size="sm"
                              loading={isPending}
                              onClick={() => handleStatusToggle(row.uid, row.status)}
                            >
                              {row.status === 'ACTIVE' ? (
                                <>
                                  <UserX className="h-4 w-4" aria-hidden="true" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                                  Reactivate
                                </>
                              )}
                            </Button>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <Card
          title="Add a user"
          subtitle="New accounts are provisioned with a script — the browser can't create a Firebase Auth account for someone else."
        >
          <p className="text-sm text-slate-500">
            Run this from <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">scripts/</code> (adjust
            email, name, and role):
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-900 px-4 py-3 text-xs text-slate-100">
            <code>{seedCommand}</code>
          </pre>
          <p className="mt-3 text-xs text-slate-400">
            It creates the Firebase Auth account (or reuses one with a matching email) and the matching{' '}
            <code className="rounded bg-slate-100 px-1 py-0.5">users/{'{uid}'}</code> document in this
            organization, then prints a password-setup link for the new user.
          </p>
        </Card>
      </div>
    </>
  )
}
