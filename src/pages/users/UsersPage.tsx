import { useEffect, useState } from 'react'
import { Mail, ShieldCheck, UserCog, UserPlus, UserX } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { hasMinimumRole } from '../../config/roles'
import { useAuth } from '../../context/AuthContext'
import { toUserMessage } from '../../lib/errors'
import { formatRole } from '../../lib/format'
import { writeAuditLog } from '../../services/audit'
import { sendPasswordReset } from '../../services/auth'
import { invitableRoles } from '../../services/invites'
import { observeOrgUsers, setUserStatus, updateUserRole } from '../../services/users'
import type { UserRecord, UserRole, UserStatus } from '../../types'
import { InviteUserModal } from './InviteUserModal'

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
  const [notice, setNotice] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const inviteRoles = invitableRoles(userRecord?.role)

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

  async function handleResend(row: UserRecord) {
    setActionError(null)
    setNotice(null)
    setPendingUid(row.uid)
    try {
      await sendPasswordReset(row.email)
      setNotice(`Password email sent to ${row.email}.`)
    } catch {
      setActionError('Could not send that email. Please try again.')
    } finally {
      setPendingUid(null)
    }
  }

  async function handleRoleChange(uid: string, role: UserRole) {
    setActionError(null)
    setPendingUid(uid)
    try {
      await updateUserRole(uid, role)
      if (userRecord && organizationId) {
        void writeAuditLog({
          organizationId,
          action: 'user.role_changed',
          actorId: userRecord.uid,
          actorRole: userRecord.role,
          targetCollection: 'users',
          targetId: uid,
          details: { role },
        })
      }
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
      if (userRecord && organizationId) {
        void writeAuditLog({
          organizationId,
          action: 'user.status_changed',
          actorId: userRecord.uid,
          actorRole: userRecord.role,
          targetCollection: 'users',
          targetId: uid,
          details: { status: next },
        })
      }
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
        description="Manage staff and driver accounts in your organization: invite people, roles and active status."
        actions={
          inviteRoles.length > 0 ? (
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Invite user
            </Button>
          ) : undefined
        }
      />

      {notice && <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p>}
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
                            <div className="flex items-center justify-end gap-2">
                            {row.status === 'ACTIVE' && (
                              <Button variant="ghost" size="sm" disabled={isPending} onClick={() => handleResend(row)} title="Email them a link to set or reset their password">
                                <Mail className="h-4 w-4" aria-hidden="true" />
                                Password email
                              </Button>
                            )}
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
                            </div>
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

      <InviteUserModal open={inviteOpen} onClose={() => setInviteOpen(false)} roles={inviteRoles} />
    </>
  )
}
