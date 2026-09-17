import { useEffect, useMemo, useState } from 'react'
import { History } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { TextField } from '../../components/ui/TextField'
import { useAuth } from '../../context/AuthContext'
import { toUserMessage } from '../../lib/errors'
import { formatDateTime, formatRole } from '../../lib/format'
import { observeOrgAuditLogs } from '../../services/audit'
import { observeOrgUsers } from '../../services/users'
import type { AuditLogRecord, UserRecord } from '../../types'

const roleBadgeTone: Record<UserRecord['role'], 'violet' | 'blue' | 'green' | 'neutral'> = {
  ADMIN: 'violet',
  MANAGER: 'blue',
  DISPATCHER: 'green',
  DRIVER: 'neutral',
}

function actionLabel(action: string): string {
  return action
    .split('.')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' — ')
}

export function AuditPage() {
  const { userRecord } = useAuth()
  const organizationId = userRecord?.organizationId

  const [logs, setLogs] = useState<AuditLogRecord[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [users, setUsers] = useState<UserRecord[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!organizationId) return
    const unsubscribe = observeOrgAuditLogs(
      organizationId,
      (records) => {
        setLogs(records)
        setLoadError(null)
      },
      (error) => setLoadError(toUserMessage(error, 'Could not load the audit trail.')),
    )
    return unsubscribe
  }, [organizationId])

  useEffect(() => {
    if (!organizationId) return
    return observeOrgUsers(organizationId, setUsers)
  }, [organizationId])

  function actorName(actorId: string): string {
    const user = users.find((u) => u.uid === actorId)
    return user ? `${user.firstName} ${user.lastName}` : actorId
  }

  const filtered = useMemo(() => {
    if (!logs) return null
    const term = search.trim().toLowerCase()
    if (!term) return logs
    return logs.filter((log) => {
      const user = users.find((u) => u.uid === log.actorId)
      const actor = user ? `${user.firstName} ${user.lastName}` : log.actorId
      return [log.action, log.targetCollection, log.targetId ?? '', actor].join(' ').toLowerCase().includes(term)
    })
  }, [logs, search, users])

  return (
    <>
      <PageHeader
        title="Audit trail"
        description="Every significant action taken in this organization — role and status changes, deletions, inspection reviews, and payroll/billing approvals. Entries are immutable once written."
      />

      <div className="mt-6">
        <Card>
          <TextField label="Search" value={search} onChange={setSearch} placeholder="Action, collection, record id, or actor" />
        </Card>
      </div>

      <div className="mt-6">
        <Card title="Entries" subtitle={filtered ? `${filtered.length} entr${filtered.length === 1 ? 'y' : 'ies'}` : undefined}>
          {loadError ? (
            <p className="text-sm text-red-600">{loadError}</p>
          ) : filtered === null ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={History}
              title="No audit entries yet"
              description="Actions like role changes, deletions, and approvals will appear here as they happen."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-medium uppercase tracking-wide text-slate-400">
                    <th className="pb-3 pr-4">When</th>
                    <th className="pb-3 pr-4">Action</th>
                    <th className="pb-3 pr-4">Actor</th>
                    <th className="pb-3 pr-4">Target</th>
                    <th className="pb-3 pr-4">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((log) => (
                    <tr key={log.logId}>
                      <td className="py-3 pr-4 whitespace-nowrap text-slate-500">{formatDateTime(log.createdAt.toDate())}</td>
                      <td className="py-3 pr-4 text-slate-700">{actionLabel(log.action)}</td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-700">{actorName(log.actorId)}</span>
                          <Badge tone={roleBadgeTone[log.actorRole]}>{formatRole(log.actorRole)}</Badge>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-slate-500">
                        {log.targetCollection}
                        {log.targetId ? ` / ${log.targetId}` : ''}
                      </td>
                      <td className="py-3 pr-4 text-xs text-slate-400">
                        {log.details ? JSON.stringify(log.details) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  )
}
