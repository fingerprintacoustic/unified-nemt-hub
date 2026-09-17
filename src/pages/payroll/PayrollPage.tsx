import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Timestamp } from 'firebase/firestore'
import { Download, Plus, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Modal } from '../../components/ui/Modal'
import { PageHeader } from '../../components/ui/PageHeader'
import { TextField } from '../../components/ui/TextField'
import { useAuth } from '../../context/AuthContext'
import { toUserMessage } from '../../lib/errors'
import { formatDate } from '../../lib/format'
import {
  approvePayrollPeriod,
  createPayrollPeriod,
  deletePayrollPeriod,
  markPayrollPeriodExported,
  observeOrgPayrollPeriods,
  reopenPayrollPeriod,
  savePayrollEntries,
} from '../../services/payroll'
import { observeOrgTrips } from '../../services/trips'
import { observeOrgUsers } from '../../services/users'
import type { PayrollEntry, PayrollPeriodRecord, TripRecord, UserRecord } from '../../types'

const statusBadgeTone: Record<PayrollPeriodRecord['status'], 'neutral' | 'blue' | 'green'> = {
  DRAFT: 'neutral',
  APPROVED: 'blue',
  EXPORTED: 'green',
}

function dateInputToTimestamp(value: string): Timestamp {
  return Timestamp.fromDate(new Date(`${value}T00:00:00`))
}

function periodTotal(period: PayrollPeriodRecord): number {
  return period.entries.reduce((sum, e) => sum + e.amount.amount, 0)
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

interface EntryDraft {
  amount: string
  notes: string
}

export function PayrollPage() {
  const { userRecord } = useAuth()
  const organizationId = userRecord?.organizationId
  const isAdmin = userRecord?.role === 'ADMIN'

  const [periods, setPeriods] = useState<PayrollPeriodRecord[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [drivers, setDrivers] = useState<UserRecord[]>([])
  const [trips, setTrips] = useState<TripRecord[]>([])

  const [newPeriodOpen, setNewPeriodOpen] = useState(false)
  const [newStart, setNewStart] = useState('')
  const [newEnd, setNewEnd] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [detailId, setDetailId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, EntryDraft>>({})
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  useEffect(() => {
    if (!organizationId) return
    const unsubscribe = observeOrgPayrollPeriods(
      organizationId,
      (records) => {
        setPeriods(records)
        setLoadError(null)
      },
      (error) => setLoadError(toUserMessage(error, 'Could not load payroll periods.')),
    )
    return unsubscribe
  }, [organizationId])

  useEffect(() => {
    if (!organizationId) return
    const unsubUsers = observeOrgUsers(organizationId, (records) =>
      setDrivers(records.filter((u) => u.role === 'DRIVER')),
    )
    const unsubTrips = observeOrgTrips(organizationId, setTrips)
    return () => {
      unsubUsers()
      unsubTrips()
    }
  }, [organizationId])

  const detail = useMemo(() => periods?.find((p) => p.periodId === detailId) ?? null, [periods, detailId])

  function completedTripCount(driverUid: string, period: PayrollPeriodRecord): number {
    return trips.filter(
      (t) =>
        t.driverId === driverUid &&
        t.status === 'COMPLETED' &&
        t.scheduledPickupAt.toMillis() >= period.startDate.toMillis() &&
        t.scheduledPickupAt.toMillis() <= period.endDate.toMillis(),
    ).length
  }

  function openNewPeriod() {
    setNewStart('')
    setNewEnd('')
    setCreateError(null)
    setNewPeriodOpen(true)
  }

  async function handleCreatePeriod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!organizationId || !userRecord) return
    setCreateError(null)
    if (!newStart || !newEnd) {
      setCreateError('Set both a start and end date.')
      return
    }
    if (newEnd < newStart) {
      setCreateError('End date must be on or after the start date.')
      return
    }
    setCreating(true)
    try {
      const id = await createPayrollPeriod({
        organizationId,
        startDate: dateInputToTimestamp(newStart),
        endDate: dateInputToTimestamp(newEnd),
        createdBy: userRecord.uid,
      })
      setNewPeriodOpen(false)
      setDetailId(id)
    } catch (error) {
      setCreateError(toUserMessage(error, 'Could not create this payroll period.'))
    } finally {
      setCreating(false)
    }
  }

  function openDetail(period: PayrollPeriodRecord) {
    const nextDrafts: Record<string, EntryDraft> = {}
    for (const driver of drivers) {
      const existing = period.entries.find((e) => e.driverId === driver.uid)
      nextDrafts[driver.uid] = {
        amount: existing ? String(existing.amount.amount) : '',
        notes: existing?.notes ?? '',
      }
    }
    setDrafts(nextDrafts)
    setActionError(null)
    setDetailId(period.periodId)
  }

  async function handleSaveEntries() {
    if (!detail) return
    setSaving(true)
    setActionError(null)
    try {
      const entries: PayrollEntry[] = []
      for (const driver of drivers) {
        const draft = drafts[driver.uid]
        const amount = draft ? Number(draft.amount) : NaN
        if (!draft || !draft.amount.trim() || !Number.isFinite(amount)) continue
        entries.push({
          driverId: driver.uid,
          amount: { amount, currency: 'USD' },
          ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {}),
        })
      }
      await savePayrollEntries(detail.periodId, entries)
    } catch (error) {
      setActionError(toUserMessage(error, 'Could not save these entries.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleApprove() {
    if (!detail || !userRecord) return
    setPendingId(detail.periodId)
    setActionError(null)
    try {
      await handleSaveEntries()
      await approvePayrollPeriod(detail.periodId, userRecord.uid)
    } catch (error) {
      setActionError(toUserMessage(error, 'Could not approve this period.'))
    } finally {
      setPendingId(null)
    }
  }

  async function handleReopen() {
    if (!detail) return
    setPendingId(detail.periodId)
    setActionError(null)
    try {
      await reopenPayrollPeriod(detail.periodId)
    } catch (error) {
      setActionError(toUserMessage(error, 'Could not reopen this period.'))
    } finally {
      setPendingId(null)
    }
  }

  function handleExport() {
    if (!detail) return
    const rows = [['Driver', 'Email', 'Amount', 'Currency', 'Notes']]
    for (const entry of detail.entries) {
      const driver = drivers.find((d) => d.uid === entry.driverId)
      rows.push([
        driver ? `${driver.firstName} ${driver.lastName}` : entry.driverId,
        driver?.email ?? '',
        entry.amount.amount.toFixed(2),
        entry.amount.currency,
        entry.notes ?? '',
      ])
    }
    const csv = rows
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `payroll-${formatDate(detail.startDate.toDate())}-${formatDate(detail.endDate.toDate())}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    if (detail.status === 'APPROVED') {
      markPayrollPeriodExported(detail.periodId).catch(() => {
        /* CSV already downloaded; a failed status bump isn't worth surfacing */
      })
    }
  }

  async function handleDelete(periodId: string) {
    setPendingId(periodId)
    setActionError(null)
    try {
      await deletePayrollPeriod(periodId)
      setConfirmDeleteId(null)
      if (detailId === periodId) setDetailId(null)
    } catch (error) {
      setActionError(toUserMessage(error, 'Could not delete this period.'))
    } finally {
      setPendingId(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Payroll"
        description="Payroll periods for drivers. Amounts are entered manually -- this app doesn't calculate pay."
        actions={
          <Button onClick={openNewPeriod}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New period
          </Button>
        }
      />

      {actionError && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{actionError}</p>
      )}

      <div className="mt-6">
        <Card title="Payroll periods" subtitle={periods ? `${periods.length} period${periods.length === 1 ? '' : 's'}` : undefined}>
          {loadError ? (
            <p className="text-sm text-red-600">{loadError}</p>
          ) : periods === null ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : periods.length === 0 ? (
            <EmptyState
              icon={Download}
              title="No payroll periods yet"
              description="Create a period to start entering driver pay for a date range."
              action={<Button onClick={openNewPeriod}>New period</Button>}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-medium uppercase tracking-wide text-slate-400">
                    <th className="pb-3 pr-4">Period</th>
                    <th className="pb-3 pr-4">Drivers paid</th>
                    <th className="pb-3 pr-4">Total</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {periods.map((period) => {
                    const isPending = pendingId === period.periodId
                    return (
                      <tr key={period.periodId}>
                        <td className="py-3 pr-4 text-slate-700">
                          {formatDate(period.startDate.toDate())} – {formatDate(period.endDate.toDate())}
                        </td>
                        <td className="py-3 pr-4 text-slate-500">{period.entries.length}</td>
                        <td className="py-3 pr-4 font-medium text-slate-700">
                          {formatMoney(periodTotal(period), period.entries[0]?.amount.currency ?? 'USD')}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge tone={statusBadgeTone[period.status]}>{period.status}</Badge>
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="secondary" size="sm" onClick={() => openDetail(period)}>
                              Open
                            </Button>
                            {isAdmin && period.status === 'DRAFT' && (
                              confirmDeleteId === period.periodId ? (
                                <>
                                  <Button
                                    variant="danger"
                                    size="sm"
                                    loading={isPending}
                                    onClick={() => handleDelete(period.periodId)}
                                  >
                                    Confirm
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(null)}>
                                    Cancel
                                  </Button>
                                </>
                              ) : (
                                <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(period.periodId)}>
                                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                                </Button>
                              )
                            )}
                          </div>
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

      <Modal open={newPeriodOpen} onClose={() => setNewPeriodOpen(false)} title="New payroll period">
        <form onSubmit={handleCreatePeriod} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Start date" type="date" value={newStart} onChange={setNewStart} required />
            <TextField label="End date" type="date" value={newEnd} onChange={setNewEnd} required />
          </div>
          {createError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{createError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setNewPeriodOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={creating}>
              Create
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={detail !== null}
        onClose={() => setDetailId(null)}
        title={detail ? `Payroll: ${formatDate(detail.startDate.toDate())} – ${formatDate(detail.endDate.toDate())}` : ''}
      >
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge tone={statusBadgeTone[detail.status]}>{detail.status}</Badge>
              <p className="text-sm font-medium text-slate-700">
                Total: {formatMoney(periodTotal(detail), 'USD')}
              </p>
            </div>

            {drivers.length === 0 ? (
              <p className="text-sm text-slate-500">No drivers in this organization yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-medium uppercase tracking-wide text-slate-400">
                      <th className="pb-2 pr-3">Driver</th>
                      <th className="pb-2 pr-3">Completed trips</th>
                      <th className="pb-2 pr-3">Amount (USD)</th>
                      <th className="pb-2 pr-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {drivers.map((driver) => {
                      const draft = drafts[driver.uid] ?? { amount: '', notes: '' }
                      const readOnly = detail.status !== 'DRAFT'
                      return (
                        <tr key={driver.uid}>
                          <td className="py-2 pr-3 text-slate-700">
                            {driver.firstName} {driver.lastName}
                          </td>
                          <td className="py-2 pr-3 text-slate-400">{completedTripCount(driver.uid, detail)}</td>
                          <td className="py-2 pr-3">
                            <input
                              type="number"
                              step="0.01"
                              value={draft.amount}
                              disabled={readOnly}
                              onChange={(event) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [driver.uid]: { ...draft, amount: event.target.value },
                                }))
                              }
                              className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-900 focus:border-blue-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
                            />
                          </td>
                          <td className="py-2 pr-3">
                            <input
                              type="text"
                              value={draft.notes}
                              disabled={readOnly}
                              onChange={(event) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [driver.uid]: { ...draft, notes: event.target.value },
                                }))
                              }
                              className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-900 focus:border-blue-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {actionError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{actionError}</p>}

            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
              {detail.status === 'DRAFT' ? (
                <>
                  <Button variant="secondary" loading={saving} onClick={handleSaveEntries}>
                    Save
                  </Button>
                  <Button loading={pendingId === detail.periodId} onClick={handleApprove}>
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    Save &amp; approve
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    loading={pendingId === detail.periodId}
                    onClick={handleReopen}
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    Reopen to draft
                  </Button>
                  <Button onClick={handleExport}>
                    <Download className="h-4 w-4" aria-hidden="true" />
                    Export CSV
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
