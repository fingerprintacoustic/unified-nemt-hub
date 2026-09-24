import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  CarFront,
  ClipboardCheck,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { hasFirebaseConfig } from '../../config/env'
import { useAuth } from '../../context/AuthContext'
import { formatDateTime, formatRole } from '../../lib/format'
import { observeOrgDrivers } from '../../services/drivers'
import { observeOrgInspections } from '../../services/inspections'
import { observeOrgTrips } from '../../services/trips'
import { observeOrgVehicles } from '../../services/vehicles'
import type { DriverRecord, InspectionRecord, TripRecord, TripStatus, VehicleRecord } from '../../types'

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

const CLOSED_STATUSES: TripStatus[] = ['COMPLETED', 'CANCELLED', 'NO_SHOW']

const STATUS_TONE: Record<TripStatus, 'neutral' | 'blue' | 'green' | 'amber' | 'red'> = {
  SCHEDULED: 'neutral',
  ASSIGNED: 'blue',
  EN_ROUTE: 'blue',
  PICKED_UP: 'blue',
  DROPPED_OFF: 'blue',
  COMPLETED: 'green',
  CANCELLED: 'red',
  NO_SHOW: 'amber',
}

function isToday(ms: number): boolean {
  const d = new Date(ms)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
  )
}

export function DashboardPage() {
  const { user, userRecord, organization } = useAuth()
  const role = userRecord?.role
  const organizationId = userRecord?.organizationId

  const [trips, setTrips] = useState<TripRecord[]>([])
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([])
  const [drivers, setDrivers] = useState<DriverRecord[]>([])
  const [inspections, setInspections] = useState<InspectionRecord[]>([])

  useEffect(() => {
    if (!organizationId) return
    const unsubs = [
      observeOrgTrips(organizationId, setTrips),
      observeOrgVehicles(organizationId, setVehicles),
      observeOrgDrivers(organizationId, setDrivers),
      observeOrgInspections(organizationId, setInspections),
    ]
    return () => unsubs.forEach((unsubscribe) => unsubscribe())
  }, [organizationId])

  const stats = useMemo(() => {
    const activeTrips = trips.filter((t) => !CLOSED_STATUSES.includes(t.status))
    const todayCount = trips.filter((t) => isToday(t.scheduledPickupAt.toMillis())).length
    const inService = vehicles.filter((v) => v.status === 'AVAILABLE' || v.status === 'ASSIGNED').length
    const activeDrivers = drivers.filter((d) => d.status === 'ACTIVE').length
    const flagged = inspections.filter((i) => i.status === 'FLAGGED').length
    const downVehicles = vehicles.filter((v) => v.status === 'MAINTENANCE' || v.status === 'OUT_OF_SERVICE').length
    const recent = [...trips]
      .sort((a, b) => b.updatedAt.toMillis() - a.updatedAt.toMillis())
      .slice(0, 6)
    const byStatus = trips.reduce<Partial<Record<TripStatus, number>>>((acc, t) => {
      acc[t.status] = (acc[t.status] ?? 0) + 1
      return acc
    }, {})
    return { activeTrips: activeTrips.length, todayCount, inService, activeDrivers, flagged, downVehicles, recent, byStatus }
  }, [trips, vehicles, drivers, inspections])

  const summaryCards: SummaryCard[] = [
    {
      label: 'Active trips',
      value: String(stats.activeTrips),
      hint: `${stats.todayCount} scheduled today`,
      icon: ClipboardCheck,
      tone: 'blue',
    },
    {
      label: 'Vehicles in service',
      value: String(stats.inService),
      hint: `${vehicles.length} in the fleet`,
      icon: CarFront,
      tone: 'green',
    },
    {
      label: 'Active drivers',
      value: String(stats.activeDrivers),
      hint: `${drivers.length} on the roster`,
      icon: Users,
      tone: 'neutral',
    },
    {
      label: 'Open issues',
      value: String(stats.flagged + stats.downVehicles),
      hint: 'Flagged inspections and vehicles out of service',
      icon: AlertTriangle,
      tone: stats.flagged + stats.downVehicles > 0 ? 'amber' : 'neutral',
    },
  ]

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={
          hasFirebaseConfig()
            ? `Welcome back, ${userRecord?.firstName ?? 'there'}.`
            : 'Local development preview — Firebase not configured.'
        }
      />

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

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Recent trips" subtitle="Most recently updated">
            {stats.recent.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="No trips yet"
                description="Schedule a trip and it will show up here as it moves through dispatch."
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {stats.recent.map((trip) => (
                  <li key={trip.tripId} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-700">
                        {trip.originAddress} → {trip.destinationAddress}
                      </p>
                      <p className="text-xs text-slate-400">Pickup {formatDateTime(trip.scheduledPickupAt.toDate())}</p>
                    </div>
                    <Badge tone={STATUS_TONE[trip.status]}>{trip.status.replace(/_/g, ' ')}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Trips by status">
            {trips.length === 0 ? (
              <p className="text-sm text-slate-500">Nothing scheduled yet.</p>
            ) : (
              <div className="space-y-2.5">
                {(Object.keys(stats.byStatus) as TripStatus[]).map((status) => (
                  <div key={status} className="flex items-center justify-between">
                    <Badge tone={STATUS_TONE[status]}>{status.replace(/_/g, ' ')}</Badge>
                    <span className="text-sm font-medium text-slate-700">{stats.byStatus[status]}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Your session">
            <div className="space-y-2 text-sm">
              <p className="flex items-center justify-between">
                <span className="text-slate-500">Signed in as</span>
                <span className="font-medium text-slate-700">{user?.email ?? '—'}</span>
              </p>
              <p className="flex items-center justify-between">
                <span className="text-slate-500">Role</span>
                <Badge tone={role === 'ADMIN' ? 'violet' : role === 'MANAGER' ? 'blue' : role === 'DISPATCHER' ? 'green' : 'neutral'}>
                  {formatRole(role ?? '—')}
                </Badge>
              </p>
              {userRecord?.organizationId && (
                <p className="flex items-center justify-between">
                  <span className="text-slate-500">Organization</span>
                  <span className="max-w-[55%] truncate font-medium text-slate-700">
                    {organization?.name ?? userRecord.organizationId}
                  </span>
                </p>
              )}
            </div>
          </Card>

          <Card title="Quick actions">
            <div className="flex flex-wrap gap-2">
              <Link to="/dispatch">
                <Badge tone="blue">Dispatch board</Badge>
              </Link>
              <Link to="/trips">
                <Badge tone="green">Schedule a trip</Badge>
              </Link>
              <Link to="/inspections">
                <Badge tone="neutral">Inspections</Badge>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
