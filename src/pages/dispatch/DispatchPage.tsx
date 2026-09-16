import { useEffect, useMemo, useState } from 'react'
import { Gauge, UserX } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { useAuth } from '../../context/AuthContext'
import { toUserMessage } from '../../lib/errors'
import { observeOrgDrivers } from '../../services/drivers'
import { observeOrgVehicles } from '../../services/vehicles'
import {
  assignTrip,
  observeOrgTrips,
  setTripStatus,
  unassignTrip,
} from '../../services/trips'
import type { DriverRecord, TripRecord, TripStatus, VehicleRecord } from '../../types'

// Trips that still need dispatcher attention. COMPLETED/CANCELLED/NO_SHOW
// are done and belong on the Trips page's full history, not this board.
const ACTIVE_STATUSES: TripStatus[] = ['SCHEDULED', 'ASSIGNED', 'EN_ROUTE', 'PICKED_UP', 'DROPPED_OFF']

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

export function DispatchPage() {
  const { userRecord } = useAuth()
  const organizationId = userRecord?.organizationId

  const [trips, setTrips] = useState<TripRecord[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [drivers, setDrivers] = useState<DriverRecord[]>([])
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([])

  const [pendingTripId, setPendingTripId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  // Per-row driver/vehicle picks in progress before "Assign" is clicked.
  const [pendingDriver, setPendingDriver] = useState<Record<string, string>>({})
  const [pendingVehicle, setPendingVehicle] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!organizationId) return
    const unsubscribe = observeOrgTrips(
      organizationId,
      (records) => {
        setTrips(records)
        setLoadError(null)
      },
      (error) => setLoadError(toUserMessage(error, 'Could not load trips for your organization.')),
    )
    return unsubscribe
  }, [organizationId])

  useEffect(() => {
    if (!organizationId) return
    const unsubDrivers = observeOrgDrivers(organizationId, (records) =>
      setDrivers(records.filter((d) => d.status === 'ACTIVE')),
    )
    const unsubVehicles = observeOrgVehicles(organizationId, (records) =>
      setVehicles(records.filter((v) => v.status !== 'OUT_OF_SERVICE')),
    )
    return () => {
      unsubDrivers()
      unsubVehicles()
    }
  }, [organizationId])

  const activeTrips = useMemo(
    () => (trips ?? []).filter((t) => ACTIVE_STATUSES.includes(t.status)),
    [trips],
  )

  async function handleAssign(trip: TripRecord) {
    const driverId = pendingDriver[trip.tripId]
    const vehicleId = pendingVehicle[trip.tripId]
    if (!driverId || !vehicleId) return
    setActionError(null)
    setPendingTripId(trip.tripId)
    try {
      await assignTrip(trip.tripId, driverId, vehicleId, trip.status)
    } catch (error) {
      setActionError(toUserMessage(error, 'Could not assign this trip.'))
    } finally {
      setPendingTripId(null)
    }
  }

  async function handleUnassign(tripId: string) {
    setActionError(null)
    setPendingTripId(tripId)
    try {
      await unassignTrip(tripId)
    } catch (error) {
      setActionError(toUserMessage(error, 'Could not unassign this trip.'))
    } finally {
      setPendingTripId(null)
    }
  }

  async function handleStatusChange(tripId: string, status: TripStatus) {
    setActionError(null)
    setPendingTripId(tripId)
    try {
      await setTripStatus(tripId, status)
    } catch (error) {
      setActionError(toUserMessage(error, 'Could not update that trip’s status.'))
    } finally {
      setPendingTripId(null)
    }
  }

  function driverLabel(driverId: string | undefined): string {
    const d = drivers.find((x) => x.driverId === driverId)
    return d ? `${d.firstName} ${d.lastName}` : 'Unknown driver'
  }

  function vehicleLabel(vehicleId: string | undefined): string {
    const v = vehicles.find((x) => x.vehicleId === vehicleId)
    return v ? `${v.year} ${v.make} ${v.model}` : 'Unknown vehicle'
  }

  return (
    <>
      <PageHeader
        title="Dispatch"
        description="Trips awaiting pickup or in progress — assign drivers and vehicles, advance status."
      />

      {actionError && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{actionError}</p>
      )}

      <div className="mt-6">
        <Card
          title="Board"
          subtitle={trips ? `${activeTrips.length} active trip${activeTrips.length === 1 ? '' : 's'}` : undefined}
        >
          {loadError ? (
            <p className="text-sm text-red-600">{loadError}</p>
          ) : trips === null ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : activeTrips.length === 0 ? (
            <EmptyState
              icon={Gauge}
              title="Nothing to dispatch"
              description="No scheduled or in-progress trips right now. Completed/cancelled trips live on the Trips page."
            />
          ) : (
            <div className="space-y-3">
              {activeTrips.map((trip) => {
                const isPending = pendingTripId === trip.tripId
                const isAssigned = Boolean(trip.driverId && trip.vehicleId)
                return (
                  <div
                    key={trip.tripId}
                    className="rounded-lg border border-slate-200 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800">
                          {trip.scheduledPickupAt.toDate().toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </p>
                        <p className="truncate text-sm text-slate-600">{trip.originAddress}</p>
                        <p className="truncate text-xs text-slate-400">→ {trip.destinationAddress}</p>
                      </div>
                      <Badge tone={statusBadgeTone[trip.status]}>{trip.status.replace(/_/g, ' ')}</Badge>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      {isAssigned ? (
                        <>
                          <span className="text-sm text-slate-600">
                            {driverLabel(trip.driverId)} · {vehicleLabel(trip.vehicleId)}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            loading={isPending}
                            onClick={() => handleUnassign(trip.tripId)}
                          >
                            <UserX className="h-4 w-4" aria-hidden="true" />
                            Unassign
                          </Button>
                        </>
                      ) : (
                        <>
                          <select
                            value={pendingDriver[trip.tripId] ?? ''}
                            onChange={(event) =>
                              setPendingDriver((prev) => ({ ...prev, [trip.tripId]: event.target.value }))
                            }
                            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700 focus:border-blue-500 focus:outline-none"
                          >
                            <option value="">Driver…</option>
                            {drivers.map((d) => (
                              <option key={d.driverId} value={d.driverId}>
                                {d.firstName} {d.lastName}
                              </option>
                            ))}
                          </select>
                          <select
                            value={pendingVehicle[trip.tripId] ?? ''}
                            onChange={(event) =>
                              setPendingVehicle((prev) => ({ ...prev, [trip.tripId]: event.target.value }))
                            }
                            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700 focus:border-blue-500 focus:outline-none"
                          >
                            <option value="">Vehicle…</option>
                            {vehicles.map((v) => (
                              <option key={v.vehicleId} value={v.vehicleId}>
                                {v.year} {v.make} {v.model}
                              </option>
                            ))}
                          </select>
                          <Button
                            size="sm"
                            loading={isPending}
                            disabled={!pendingDriver[trip.tripId] || !pendingVehicle[trip.tripId]}
                            onClick={() => handleAssign(trip)}
                          >
                            Assign
                          </Button>
                        </>
                      )}

                      <select
                        value={trip.status}
                        disabled={isPending}
                        onChange={(event) => handleStatusChange(trip.tripId, event.target.value as TripStatus)}
                        className="ml-auto rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700 focus:border-blue-500 focus:outline-none disabled:opacity-60"
                      >
                        {ACTIVE_STATUSES.concat(['COMPLETED', 'CANCELLED', 'NO_SHOW']).map((status) => (
                          <option key={status} value={status}>
                            {status.replace(/_/g, ' ')}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>
    </>
  )
}
