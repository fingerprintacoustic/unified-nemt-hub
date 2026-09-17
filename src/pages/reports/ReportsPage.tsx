import { useEffect, useMemo, useState } from 'react'
import { Timestamp } from 'firebase/firestore'
import {
  BarChart3,
  Camera,
  CarFront,
  CheckCircle2,
  ClipboardCheck,
  DollarSign,
  Flag,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { TextField } from '../../components/ui/TextField'
import { useAuth } from '../../context/AuthContext'
import { observeOrgInspections } from '../../services/inspections'
import { observeOrgTrips } from '../../services/trips'
import { observeOrgVehicles } from '../../services/vehicles'
import type { InspectionRecord, TripRecord, TripStatus, VehicleRecord, VehicleStatus } from '../../types'

function dateInputToTimestamp(value: string, endOfDay = false): Timestamp {
  return Timestamp.fromDate(new Date(`${value}T${endOfDay ? '23:59:59' : '00:00:00'}`))
}

function defaultRangeStart(): string {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().slice(0, 10)
}

function defaultRangeEnd(): string {
  return new Date().toISOString().slice(0, 10)
}

const TRIP_STATUS_TONE: Record<TripStatus, 'neutral' | 'blue' | 'green' | 'amber' | 'red'> = {
  SCHEDULED: 'neutral',
  ASSIGNED: 'blue',
  EN_ROUTE: 'blue',
  PICKED_UP: 'blue',
  DROPPED_OFF: 'blue',
  COMPLETED: 'green',
  CANCELLED: 'red',
  NO_SHOW: 'amber',
}

const VEHICLE_STATUS_TONE: Record<VehicleStatus, 'neutral' | 'blue' | 'green' | 'amber' | 'red'> = {
  AVAILABLE: 'green',
  ASSIGNED: 'blue',
  MAINTENANCE: 'amber',
  OUT_OF_SERVICE: 'red',
}

interface SummaryCard {
  label: string
  value: string
  hint: string
  icon: LucideIcon
  tone: 'neutral' | 'green' | 'amber' | 'blue'
}

const toneClasses: Record<SummaryCard['tone'], string> = {
  neutral: 'bg-slate-50 text-slate-600',
  green: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  blue: 'bg-blue-50 text-blue-600',
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

export function ReportsPage() {
  const { userRecord } = useAuth()
  const organizationId = userRecord?.organizationId

  const [trips, setTrips] = useState<TripRecord[] | null>(null)
  const [vehicles, setVehicles] = useState<VehicleRecord[] | null>(null)
  const [inspections, setInspections] = useState<InspectionRecord[] | null>(null)

  const [rangeStart, setRangeStart] = useState(defaultRangeStart())
  const [rangeEnd, setRangeEnd] = useState(defaultRangeEnd())

  useEffect(() => {
    if (!organizationId) return
    const unsubTrips = observeOrgTrips(organizationId, setTrips)
    const unsubVehicles = observeOrgVehicles(organizationId, setVehicles)
    const unsubInspections = observeOrgInspections(organizationId, setInspections)
    return () => {
      unsubTrips()
      unsubVehicles()
      unsubInspections()
    }
  }, [organizationId])

  const rangeStartMs = useMemo(() => dateInputToTimestamp(rangeStart).toMillis(), [rangeStart])
  const rangeEndMs = useMemo(() => dateInputToTimestamp(rangeEnd, true).toMillis(), [rangeEnd])

  const tripsInRange = useMemo(
    () => (trips ?? []).filter((t) => {
      const ms = t.scheduledPickupAt.toMillis()
      return ms >= rangeStartMs && ms <= rangeEndMs
    }),
    [trips, rangeStartMs, rangeEndMs],
  )

  const inspectionsInRange = useMemo(
    () => (inspections ?? []).filter((i) => {
      const ms = i.occurredAt.toMillis()
      return ms >= rangeStartMs && ms <= rangeEndMs
    }),
    [inspections, rangeStartMs, rangeEndMs],
  )

  const tripsByStatus = useMemo(() => {
    const counts = {} as Record<TripStatus, number>
    for (const t of tripsInRange) counts[t.status] = (counts[t.status] ?? 0) + 1
    return counts
  }, [tripsInRange])

  const completed = tripsByStatus.COMPLETED ?? 0
  const cancelled = tripsByStatus.CANCELLED ?? 0
  const noShow = tripsByStatus.NO_SHOW ?? 0
  const terminalCount = completed + cancelled + noShow
  const completionRate = terminalCount > 0 ? (completed / terminalCount) * 100 : null

  const revenue = useMemo(
    () => tripsInRange.filter((t) => t.status === 'COMPLETED' && t.fare).reduce((sum, t) => sum + (t.fare?.amount ?? 0), 0),
    [tripsInRange],
  )

  const vehiclesByStatus = useMemo(() => {
    const counts = {} as Record<VehicleStatus, number>
    for (const v of vehicles ?? []) counts[v.status] = (counts[v.status] ?? 0) + 1
    return counts
  }, [vehicles])

  const flaggedCount = inspectionsInRange.filter((i) => i.flagged).length
  const flaggedRate = inspectionsInRange.length > 0 ? (flaggedCount / inspectionsInRange.length) * 100 : null

  const loading = trips === null || vehicles === null || inspections === null

  const summaryCards: SummaryCard[] = [
    { label: 'Trips in range', value: String(tripsInRange.length), hint: `${rangeStart} – ${rangeEnd}`, icon: ClipboardCheck, tone: 'blue' },
    {
      label: 'Completion rate',
      value: completionRate === null ? '—' : `${completionRate.toFixed(0)}%`,
      hint: `${completed} completed / ${cancelled} cancelled / ${noShow} no-show`,
      icon: CheckCircle2,
      tone: 'green',
    },
    { label: 'Revenue (fared, completed)', value: formatMoney(revenue, 'USD'), hint: 'From trips with a fare set', icon: DollarSign, tone: 'blue' },
    {
      label: 'Inspection flag rate',
      value: flaggedRate === null ? '—' : `${flaggedRate.toFixed(0)}%`,
      hint: `${flaggedCount} of ${inspectionsInRange.length} in range`,
      icon: Flag,
      tone: flaggedRate && flaggedRate > 0 ? 'amber' : 'neutral',
    },
  ]

  return (
    <>
      <PageHeader
        title="Reports"
        description="Operational reporting derived from trips, vehicles, and inspections already in the system — nothing here is a separate system of record."
      />

      <div className="mt-6">
        <Card title="Date range">
          <div className="grid grid-cols-2 gap-4 sm:max-w-md">
            <TextField label="From" type="date" value={rangeStart} onChange={setRangeStart} />
            <TextField label="To" type="date" value={rangeEnd} onChange={setRangeEnd} />
          </div>
        </Card>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => (
              <Card key={card.label} className="p-0">
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${toneClasses[card.tone]}`}>
                    <card.icon className="h-5.5 w-5.5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-2xl font-bold text-slate-900">{card.value}</p>
                    <p className="truncate text-sm text-slate-500">{card.label}</p>
                  </div>
                </div>
                <div className="border-t border-slate-100 px-5 py-2 text-xs text-slate-400">{card.hint}</div>
              </Card>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card title="Trips by status" subtitle="Within the selected date range">
              {tripsInRange.length === 0 ? (
                <EmptyState icon={BarChart3} title="No trips in range" description="Widen the date range to see trip volume." />
              ) : (
                <div className="space-y-2.5">
                  {(Object.keys(tripsByStatus) as TripStatus[]).map((status) => (
                    <div key={status} className="flex items-center justify-between">
                      <Badge tone={TRIP_STATUS_TONE[status]}>{status}</Badge>
                      <span className="text-sm font-medium text-slate-700">{tripsByStatus[status]}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title="Fleet utilization" subtitle="Current vehicle status, all vehicles">
              {(vehicles ?? []).length === 0 ? (
                <EmptyState icon={CarFront} title="No vehicles yet" description="Add vehicles to see fleet utilization." />
              ) : (
                <div className="space-y-2.5">
                  {(Object.keys(vehiclesByStatus) as VehicleStatus[]).map((status) => (
                    <div key={status} className="flex items-center justify-between">
                      <Badge tone={VEHICLE_STATUS_TONE[status]}>{status}</Badge>
                      <span className="text-sm font-medium text-slate-700">{vehiclesByStatus[status]}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div className="mt-6">
            <Card title="Inspection compliance" subtitle="Within the selected date range">
              {inspectionsInRange.length === 0 ? (
                <EmptyState icon={Camera} title="No inspections in range" description="Widen the date range to see compliance data." />
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{inspectionsInRange.length}</p>
                    <p className="text-sm text-slate-500">Total inspections</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{inspectionsInRange.filter((i) => i.status === 'APPROVED').length}</p>
                    <p className="text-sm text-slate-500">Approved</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-amber-600">{flaggedCount}</p>
                    <p className="text-sm text-slate-500">Flagged</p>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </>
  )
}
