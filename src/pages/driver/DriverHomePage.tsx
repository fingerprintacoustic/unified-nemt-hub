import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Camera, CalendarClock, ChevronRight, MapPin } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { useAuth } from '../../context/AuthContext'
import { toUserMessage } from '../../lib/errors'
import { observeOrgVehicles } from '../../services/vehicles'
import { observeMyTrips, setTripStatus } from '../../services/trips'
import type { TripRecord, TripStatus, VehicleRecord } from '../../types'

// What a driver can move a trip to next, themself, from the Driver PWA.
// Dispatch (SCHEDULED -> ASSIGNED) and terminal outcomes (CANCELLED,
// NO_SHOW) stay a dispatcher decision -- not offered here.
const NEXT_STATUS: Partial<Record<TripStatus, { next: TripStatus; label: string }>> = {
  SCHEDULED: { next: 'EN_ROUTE', label: 'Start trip' },
  ASSIGNED: { next: 'EN_ROUTE', label: 'Start trip' },
  EN_ROUTE: { next: 'PICKED_UP', label: 'Mark picked up' },
  PICKED_UP: { next: 'DROPPED_OFF', label: 'Mark dropped off' },
  DROPPED_OFF: { next: 'COMPLETED', label: 'Mark completed' },
}

const TERMINAL_STATUSES: TripStatus[] = ['COMPLETED', 'CANCELLED', 'NO_SHOW']

const statusBadgeTone: Record<TripStatus, 'neutral' | 'blue' | 'green' | 'red' | 'amber'> = {
  SCHEDULED: 'neutral',
  ASSIGNED: 'blue',
  EN_ROUTE: 'blue',
  PICKED_UP: 'blue',
  DROPPED_OFF: 'green',
  COMPLETED: 'green',
  CANCELLED: 'red',
  NO_SHOW: 'amber',
}

export function DriverHomePage() {
  const { user, userRecord } = useAuth()
  const driverUid = user?.uid
  const organizationId = userRecord?.organizationId

  const [trips, setTrips] = useState<TripRecord[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([])
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (!driverUid) return
    const unsubscribe = observeMyTrips(
      driverUid,
      (records) => {
        setTrips(records)
        setLoadError(null)
      },
      (error) => setLoadError(toUserMessage(error, 'Could not load your trips.')),
    )
    return unsubscribe
  }, [driverUid])

  useEffect(() => {
    if (!organizationId) return
    return observeOrgVehicles(organizationId, setVehicles)
  }, [organizationId])

  const activeTrips = useMemo(
    () => (trips ?? []).filter((t) => !TERMINAL_STATUSES.includes(t.status)),
    [trips],
  )
  const recentHistory = useMemo(
    () => (trips ?? []).filter((t) => TERMINAL_STATUSES.includes(t.status)).slice(-5).reverse(),
    [trips],
  )

  function vehicleFor(vehicleId: string | undefined): VehicleRecord | undefined {
    return vehicles.find((v) => v.vehicleId === vehicleId)
  }

  async function handleAdvance(trip: TripRecord) {
    const step = NEXT_STATUS[trip.status]
    if (!step) return
    setActionError(null)
    setPendingId(trip.tripId)
    try {
      await setTripStatus(trip.tripId, step.next)
    } catch (error) {
      setActionError(toUserMessage(error, 'Could not update this trip.'))
    } finally {
      setPendingId(null)
    }
  }

  return (
    <>
      <PageHeader title="My Trips" description="Trips assigned to you." />

      {actionError && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{actionError}</p>
      )}

      <div className="mt-4">
        {loadError ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{loadError}</p>
        ) : trips === null ? (
          <p className="text-sm text-slate-500">Loading your trips…</p>
        ) : activeTrips.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="No upcoming trips"
            description="Once dispatch assigns you a trip, it shows up here with pickup time, address, and vehicle."
          />
        ) : (
          <div className="space-y-3">
            {activeTrips.map((trip) => {
              const vehicle = vehicleFor(trip.vehicleId)
              const step = NEXT_STATUS[trip.status]
              const isPending = pendingId === trip.tripId
              return (
                <Card key={trip.tripId}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-800">
                      {trip.scheduledPickupAt.toDate().toLocaleString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                    <Badge tone={statusBadgeTone[trip.status]}>{trip.status.replace(/_/g, ' ')}</Badge>
                  </div>

                  <div className="mt-3 space-y-2 text-sm text-slate-600">
                    <div className="flex items-start gap-2">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                      <div>
                        <p>{trip.originAddress}</p>
                        <p className="text-slate-400">→ {trip.destinationAddress}</p>
                      </div>
                    </div>
                    {vehicle && (
                      <p className="text-xs text-slate-400">
                        Vehicle: {vehicle.year} {vehicle.make} {vehicle.model} · {vehicle.plate}
                      </p>
                    )}
                    {trip.mobilityNeeds && trip.mobilityNeeds.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {trip.mobilityNeeds.map((need) => (
                          <Badge key={need} tone="violet">
                            {need}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {trip.notes && <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs">{trip.notes}</p>}
                  </div>

                  {step && (
                    <Button
                      className="mt-4 w-full"
                      loading={isPending}
                      onClick={() => handleAdvance(trip)}
                    >
                      {step.label}
                    </Button>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {recentHistory.length > 0 && (
        <div className="mt-6">
          <Card title="Recent history">
            <ul className="divide-y divide-slate-100">
              {recentHistory.map((trip) => (
                <li key={trip.tripId} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate text-slate-700">{trip.destinationAddress}</p>
                    <p className="text-xs text-slate-400">
                      {trip.scheduledPickupAt.toDate().toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                  <Badge tone={statusBadgeTone[trip.status]}>{trip.status.replace(/_/g, ' ')}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      <div className="mt-6">
        <Link
          to="/driver/inspections"
          className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-blue-300 hover:bg-blue-50"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-blue-600 ring-1 ring-slate-200">
            <Camera className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-slate-800">Start an inspection</span>
            <span className="block text-xs text-slate-500">Pre-trip / post-trip vehicle check</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-blue-500" aria-hidden="true" />
        </Link>
      </div>
    </>
  )
}
