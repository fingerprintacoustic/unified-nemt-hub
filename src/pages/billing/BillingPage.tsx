import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Timestamp } from 'firebase/firestore'
import { Download, Plus, Receipt, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react'
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
import { writeAuditLog } from '../../services/audit'
import {
  createBillingPeriod,
  deleteBillingPeriod,
  finalizeBillingPeriod,
  markBillingPeriodExported,
  observeOrgBillingPeriods,
  reopenBillingPeriod,
} from '../../services/billing'
import { observeOrgTrips } from '../../services/trips'
import type { BillingLineItem, BillingPeriodRecord, TripRecord } from '../../types'

const statusBadgeTone: Record<BillingPeriodRecord['status'], 'neutral' | 'blue' | 'green'> = {
  DRAFT: 'neutral',
  FINALIZED: 'blue',
  EXPORTED: 'green',
}

function dateInputToTimestamp(value: string): Timestamp {
  return Timestamp.fromDate(new Date(`${value}T00:00:00`))
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

/** Trips this period would bill if finalized right now: COMPLETED, has a
 * fare, within the date range, and matching the broker filter if one is
 * set. Recomputed live while DRAFT so the preview always reflects current
 * trip data -- only `finalize` freezes it. */
function matchingTrips(period: BillingPeriodRecord, trips: TripRecord[]): TripRecord[] {
  return trips.filter(
    (t) =>
      t.status === 'COMPLETED' &&
      t.fare &&
      t.scheduledPickupAt.toMillis() >= period.startDate.toMillis() &&
      t.scheduledPickupAt.toMillis() <= period.endDate.toMillis() &&
      (!period.brokerId || t.brokerId === period.brokerId),
  )
}

function tripsToLineItems(trips: TripRecord[]): BillingLineItem[] {
  return trips.map((t) => ({
    tripId: t.tripId,
    scheduledPickupAt: t.scheduledPickupAt,
    originAddress: t.originAddress,
    destinationAddress: t.destinationAddress,
    ...(t.brokerId ? { brokerId: t.brokerId } : {}),
    fare: t.fare!,
  }))
}

function lineItemsTotal(items: BillingLineItem[]): number {
  return items.reduce((sum, i) => sum + i.fare.amount, 0)
}

export function BillingPage() {
  const { userRecord } = useAuth()
  const organizationId = userRecord?.organizationId
  const isAdmin = userRecord?.role === 'ADMIN'

  const [periods, setPeriods] = useState<BillingPeriodRecord[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [trips, setTrips] = useState<TripRecord[]>([])

  const [newPeriodOpen, setNewPeriodOpen] = useState(false)
  const [newStart, setNewStart] = useState('')
  const [newEnd, setNewEnd] = useState('')
  const [newBroker, setNewBroker] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [detailId, setDetailId] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  useEffect(() => {
    if (!organizationId) return
    const unsubscribe = observeOrgBillingPeriods(
      organizationId,
      (records) => {
        setPeriods(records)
        setLoadError(null)
      },
      (error) => setLoadError(toUserMessage(error, 'Could not load billing periods.')),
    )
    return unsubscribe
  }, [organizationId])

  useEffect(() => {
    if (!organizationId) return
    return observeOrgTrips(organizationId, setTrips)
  }, [organizationId])

  const detail = useMemo(() => periods?.find((p) => p.periodId === detailId) ?? null, [periods, detailId])
  const previewTrips = useMemo(() => (detail && detail.status === 'DRAFT' ? matchingTrips(detail, trips) : []), [detail, trips])

  function openNewPeriod() {
    setNewStart('')
    setNewEnd('')
    setNewBroker('')
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
      const id = await createBillingPeriod({
        organizationId,
        startDate: dateInputToTimestamp(newStart),
        endDate: dateInputToTimestamp(newEnd),
        ...(newBroker.trim() ? { brokerId: newBroker.trim() } : {}),
        createdBy: userRecord.uid,
      })
      setNewPeriodOpen(false)
      setDetailId(id)
    } catch (error) {
      setCreateError(toUserMessage(error, 'Could not create this billing period.'))
    } finally {
      setCreating(false)
    }
  }

  async function handleFinalize() {
    if (!detail || !userRecord) return
    setPendingId(detail.periodId)
    setActionError(null)
    try {
      const items = tripsToLineItems(previewTrips)
      const totalAmount = { amount: lineItemsTotal(items), currency: 'USD' }
      await finalizeBillingPeriod(detail.periodId, items, totalAmount, userRecord.uid)
      if (organizationId) {
        void writeAuditLog({
          organizationId,
          action: 'billing.finalized',
          actorId: userRecord.uid,
          actorRole: userRecord.role,
          targetCollection: 'billingPeriods',
          targetId: detail.periodId,
          details: { tripCount: items.length, total: totalAmount.amount },
        })
      }
    } catch (error) {
      setActionError(toUserMessage(error, 'Could not finalize this period.'))
    } finally {
      setPendingId(null)
    }
  }

  async function handleReopen() {
    if (!detail) return
    setPendingId(detail.periodId)
    setActionError(null)
    try {
      await reopenBillingPeriod(detail.periodId)
    } catch (error) {
      setActionError(toUserMessage(error, 'Could not reopen this period.'))
    } finally {
      setPendingId(null)
    }
  }

  function handleExport() {
    if (!detail) return
    const rows = [['Trip ID', 'Pickup date', 'Origin', 'Destination', 'Broker', 'Fare', 'Currency']]
    for (const item of detail.lineItems) {
      rows.push([
        item.tripId,
        formatDate(item.scheduledPickupAt.toDate()),
        item.originAddress,
        item.destinationAddress,
        item.brokerId ?? '',
        item.fare.amount.toFixed(2),
        item.fare.currency,
      ])
    }
    const csv = rows
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `billing-${formatDate(detail.startDate.toDate())}-${formatDate(detail.endDate.toDate())}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    if (detail.status === 'FINALIZED') {
      markBillingPeriodExported(detail.periodId).catch(() => {
        /* CSV already downloaded; a failed status bump isn't worth surfacing */
      })
    }
  }

  async function handleDelete(periodId: string) {
    setPendingId(periodId)
    setActionError(null)
    try {
      await deleteBillingPeriod(periodId)
      if (userRecord && organizationId) {
        void writeAuditLog({
          organizationId,
          action: 'billing.deleted',
          actorId: userRecord.uid,
          actorRole: userRecord.role,
          targetCollection: 'billingPeriods',
          targetId: periodId,
        })
      }
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
        title="Billing"
        description="Billing periods built from trips' existing fare data. Finalize to lock the numbers, then export a CSV for your billing system."
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
        <Card title="Billing periods" subtitle={periods ? `${periods.length} period${periods.length === 1 ? '' : 's'}` : undefined}>
          {loadError ? (
            <p className="text-sm text-red-600">{loadError}</p>
          ) : periods === null ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : periods.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No billing periods yet"
              description="Create a period to see which completed, fared trips it would bill."
              action={<Button onClick={openNewPeriod}>New period</Button>}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-medium uppercase tracking-wide text-slate-400">
                    <th className="pb-3 pr-4">Period</th>
                    <th className="pb-3 pr-4">Broker</th>
                    <th className="pb-3 pr-4">Trips</th>
                    <th className="pb-3 pr-4">Total</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {periods.map((period) => {
                    const isPending = pendingId === period.periodId
                    const tripCount = period.status === 'DRAFT' ? matchingTrips(period, trips).length : period.lineItems.length
                    const total = period.status === 'DRAFT' ? lineItemsTotal(tripsToLineItems(matchingTrips(period, trips))) : period.totalAmount.amount
                    return (
                      <tr key={period.periodId}>
                        <td className="py-3 pr-4 text-slate-700">
                          {formatDate(period.startDate.toDate())} – {formatDate(period.endDate.toDate())}
                        </td>
                        <td className="py-3 pr-4 text-slate-500">{period.brokerId ?? 'All'}</td>
                        <td className="py-3 pr-4 text-slate-500">{tripCount}</td>
                        <td className="py-3 pr-4 font-medium text-slate-700">{formatMoney(total, 'USD')}</td>
                        <td className="py-3 pr-4">
                          <Badge tone={statusBadgeTone[period.status]}>{period.status}</Badge>
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="secondary" size="sm" onClick={() => setDetailId(period.periodId)}>
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

      <Modal open={newPeriodOpen} onClose={() => setNewPeriodOpen(false)} title="New billing period">
        <form onSubmit={handleCreatePeriod} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Start date" type="date" value={newStart} onChange={setNewStart} required />
            <TextField label="End date" type="date" value={newEnd} onChange={setNewEnd} required />
          </div>
          <TextField
            label="Broker ID (optional)"
            value={newBroker}
            onChange={setNewBroker}
            placeholder="Leave blank to bill every broker"
          />
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
        title={detail ? `Billing: ${formatDate(detail.startDate.toDate())} – ${formatDate(detail.endDate.toDate())}` : ''}
      >
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge tone={statusBadgeTone[detail.status]}>{detail.status}</Badge>
              <p className="text-sm font-medium text-slate-700">
                Total:{' '}
                {formatMoney(
                  detail.status === 'DRAFT' ? lineItemsTotal(tripsToLineItems(previewTrips)) : detail.totalAmount.amount,
                  'USD',
                )}
              </p>
            </div>
            {detail.brokerId && <p className="text-xs text-slate-500">Broker filter: {detail.brokerId}</p>}

            {(() => {
              const rows = detail.status === 'DRAFT' ? tripsToLineItems(previewTrips) : detail.lineItems
              return rows.length === 0 ? (
                <p className="text-sm text-slate-500">
                  {detail.status === 'DRAFT'
                    ? 'No completed, fared trips match this date range yet.'
                    : 'No trips were included in this period.'}
                </p>
              ) : (
                <div className="max-h-72 overflow-y-auto overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-xs font-medium uppercase tracking-wide text-slate-400">
                        <th className="pb-2 pr-3">Pickup</th>
                        <th className="pb-2 pr-3">Origin</th>
                        <th className="pb-2 pr-3">Destination</th>
                        <th className="pb-2 pr-3">Fare</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map((item) => (
                        <tr key={item.tripId}>
                          <td className="py-2 pr-3 text-slate-700">{formatDate(item.scheduledPickupAt.toDate())}</td>
                          <td className="py-2 pr-3 text-slate-500">{item.originAddress}</td>
                          <td className="py-2 pr-3 text-slate-500">{item.destinationAddress}</td>
                          <td className="py-2 pr-3 text-slate-700">{formatMoney(item.fare.amount, item.fare.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })()}

            {actionError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{actionError}</p>}

            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
              {detail.status === 'DRAFT' ? (
                <Button loading={pendingId === detail.periodId} onClick={handleFinalize}>
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  Finalize
                </Button>
              ) : (
                <>
                  <Button variant="secondary" loading={pendingId === detail.periodId} onClick={handleReopen}>
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
