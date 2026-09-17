import { useEffect, useState, type FormEvent } from 'react'
import { GeoPoint, Timestamp } from 'firebase/firestore'
import { ClipboardCheck, Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Modal } from '../../components/ui/Modal'
import { PageHeader } from '../../components/ui/PageHeader'
import { TextField } from '../../components/ui/TextField'
import { useAuth } from '../../context/AuthContext'
import { hasGoogleMapsConfig } from '../../config/env'
import { geocodeAddress } from '../../services/geocoding'
import { toUserMessage } from '../../lib/errors'
import { observeOrgDrivers } from '../../services/drivers'
import { observeOrgVehicles } from '../../services/vehicles'
import { writeAuditLog } from '../../services/audit'
import {
  createTrip,
  deleteTrip,
  observeOrgTrips,
  setTripStatus,
  updateTrip,
  type NewTripInput,
} from '../../services/trips'
import type { DriverRecord, MobilityNeeds, TripRecord, TripStatus, VehicleRecord } from '../../types'

const STATUS_OPTIONS: TripStatus[] = [
  'SCHEDULED',
  'ASSIGNED',
  'EN_ROUTE',
  'PICKED_UP',
  'DROPPED_OFF',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
]

const MOBILITY_OPTIONS: MobilityNeeds[] = ['WHEELCHAIR', 'STRETCHER', 'AMBULATORY', 'OTHER']

interface TripFormState {
  scheduledPickupAt: string
  scheduledDropoffAt: string
  originAddress: string
  originLat: string
  originLng: string
  originVerified: boolean
  destinationAddress: string
  destinationLat: string
  destinationLng: string
  destinationVerified: boolean
  mobilityNeeds: MobilityNeeds[]
  driverId: string
  vehicleId: string
  status: TripStatus
  fareAmount: string
  fareCurrency: string
  distanceMiles: string
  estimatedMinutes: string
  brokerId: string
  notes: string
}

const EMPTY_FORM: TripFormState = {
  scheduledPickupAt: '',
  scheduledDropoffAt: '',
  originAddress: '',
  originLat: '',
  originLng: '',
  originVerified: false,
  destinationAddress: '',
  destinationLat: '',
  destinationLng: '',
  destinationVerified: false,
  mobilityNeeds: [],
  driverId: '',
  vehicleId: '',
  status: 'SCHEDULED',
  fareAmount: '',
  fareCurrency: 'USD',
  distanceMiles: '',
  estimatedMinutes: '',
  brokerId: '',
  notes: '',
}

function toDateTimeInputValue(value: Timestamp | undefined): string {
  if (!value) return ''
  const d = value.toDate()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function tripToForm(trip: TripRecord): TripFormState {
  return {
    scheduledPickupAt: toDateTimeInputValue(trip.scheduledPickupAt),
    scheduledDropoffAt: toDateTimeInputValue(trip.scheduledDropoffAt),
    originAddress: trip.originAddress,
    originLat: String(trip.origin.latitude),
    originLng: String(trip.origin.longitude),
    originVerified: true,
    destinationAddress: trip.destinationAddress,
    destinationLat: String(trip.destination.latitude),
    destinationLng: String(trip.destination.longitude),
    destinationVerified: true,
    mobilityNeeds: trip.mobilityNeeds ?? [],
    driverId: trip.driverId ?? '',
    vehicleId: trip.vehicleId ?? '',
    status: trip.status,
    fareAmount: trip.fare ? String(trip.fare.amount) : '',
    fareCurrency: trip.fare?.currency ?? 'USD',
    distanceMiles: trip.distanceMiles !== undefined ? String(trip.distanceMiles) : '',
    estimatedMinutes: trip.estimatedMinutes !== undefined ? String(trip.estimatedMinutes) : '',
    brokerId: trip.brokerId ?? '',
    notes: trip.notes ?? '',
  }
}

export function TripsPage() {
  const { userRecord } = useAuth()
  const organizationId = userRecord?.organizationId
  const canDelete = userRecord?.role === 'ADMIN'
  const mapsConfigured = hasGoogleMapsConfig()

  const [trips, setTrips] = useState<TripRecord[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [drivers, setDrivers] = useState<DriverRecord[]>([])
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([])

  const [modalTrip, setModalTrip] = useState<TripRecord | 'new' | null>(null)
  const [form, setForm] = useState<TripFormState>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [verifyingOrigin, setVerifyingOrigin] = useState(false)
  const [verifyingDestination, setVerifyingDestination] = useState(false)
  const [originNote, setOriginNote] = useState<string | null>(null)
  const [destinationNote, setDestinationNote] = useState<string | null>(null)

  const [pendingId, setPendingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

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
    const unsubDrivers = observeOrgDrivers(organizationId, setDrivers)
    const unsubVehicles = observeOrgVehicles(organizationId, setVehicles)
    return () => {
      unsubDrivers()
      unsubVehicles()
    }
  }, [organizationId])

  const isEditing = typeof modalTrip === 'object' && modalTrip !== null

  // TripRecord.driverId is compared to request.auth.uid in firestore.rules
  // (isDriver() && resource.data.driverId == request.auth.uid), so it must
  // hold the driver's Firebase Auth uid -- i.e. DriverRecord.userId -- not
  // DriverRecord.driverId (that record's own Firestore doc id).
  function driverName(driverUid: string | undefined): string {
    if (!driverUid) return 'Unassigned'
    const d = drivers.find((x) => x.userId === driverUid)
    return d ? `${d.firstName} ${d.lastName}` : 'Unknown driver'
  }

  function vehicleName(vehicleId: string | undefined): string {
    if (!vehicleId) return 'Unassigned'
    const v = vehicles.find((x) => x.vehicleId === vehicleId)
    return v ? `${v.year} ${v.make} ${v.model}` : 'Unknown vehicle'
  }

  function openCreate() {
    setForm(EMPTY_FORM)
    setFormError(null)
    setOriginNote(null)
    setDestinationNote(null)
    setModalTrip('new')
  }

  function openEdit(trip: TripRecord) {
    setForm(tripToForm(trip))
    setFormError(null)
    setOriginNote(mapsConfigured ? 'Using the address already on file.' : null)
    setDestinationNote(mapsConfigured ? 'Using the address already on file.' : null)
    setModalTrip(trip)
  }

  function closeModal() {
    setModalTrip(null)
  }

  function updateField<K extends keyof TripFormState>(key: K, value: TripFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function toggleMobility(need: MobilityNeeds) {
    setForm((prev) => ({
      ...prev,
      mobilityNeeds: prev.mobilityNeeds.includes(need)
        ? prev.mobilityNeeds.filter((n) => n !== need)
        : [...prev.mobilityNeeds, need],
    }))
  }

  async function verifyAddress(which: 'origin' | 'destination') {
    const address = which === 'origin' ? form.originAddress : form.destinationAddress
    if (!address.trim()) {
      (which === 'origin' ? setOriginNote : setDestinationNote)('Enter an address first.')
      return
    }
    const setVerifying = which === 'origin' ? setVerifyingOrigin : setVerifyingDestination
    const setNote = which === 'origin' ? setOriginNote : setDestinationNote
    setVerifying(true)
    setNote(null)
    try {
      const result = await geocodeAddress(address)
      setForm((prev) => ({
        ...prev,
        ...(which === 'origin'
          ? { originLat: String(result.lat), originLng: String(result.lng), originVerified: true }
          : {
              destinationLat: String(result.lat),
              destinationLng: String(result.lng),
              destinationVerified: true,
            }),
      }))
      setNote(`Found: ${result.formattedAddress}`)
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Could not verify that address.')
    } finally {
      setVerifying(false)
    }
  }

  function handleAddressChange(which: 'origin' | 'destination', value: string) {
    if (which === 'origin') {
      updateField('originAddress', value)
      updateField('originVerified', false)
      setOriginNote(null)
    } else {
      updateField('destinationAddress', value)
      updateField('destinationVerified', false)
      setDestinationNote(null)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!organizationId || !userRecord) return
    setFormError(null)

    if (!form.scheduledPickupAt) {
      setFormError('Scheduled pickup time is required.')
      return
    }
    if (!form.originAddress.trim() || !form.destinationAddress.trim()) {
      setFormError('Origin and destination addresses are required.')
      return
    }

    let originLat: number
    let originLng: number
    let destinationLat: number
    let destinationLng: number

    if (mapsConfigured) {
      if (!form.originVerified || !form.destinationVerified) {
        setFormError('Verify both addresses before saving (click "Verify" next to each).')
        return
      }
      originLat = Number(form.originLat)
      originLng = Number(form.originLng)
      destinationLat = Number(form.destinationLat)
      destinationLng = Number(form.destinationLng)
    } else {
      originLat = Number(form.originLat)
      originLng = Number(form.originLng)
      destinationLat = Number(form.destinationLat)
      destinationLng = Number(form.destinationLng)
      if (
        !Number.isFinite(originLat) ||
        !Number.isFinite(originLng) ||
        !Number.isFinite(destinationLat) ||
        !Number.isFinite(destinationLng)
      ) {
        setFormError('Enter valid latitude/longitude for both origin and destination.')
        return
      }
    }

    setSubmitting(true)
    try {
      const fareAmount = form.fareAmount.trim() ? Number(form.fareAmount) : undefined
      const distanceMiles = form.distanceMiles.trim() ? Number(form.distanceMiles) : undefined
      const estimatedMinutes = form.estimatedMinutes.trim() ? Number(form.estimatedMinutes) : undefined

      const payload: NewTripInput = {
        organizationId,
        status: form.status,
        scheduledPickupAt: Timestamp.fromDate(new Date(form.scheduledPickupAt)),
        origin: new GeoPoint(originLat, originLng),
        destination: new GeoPoint(destinationLat, destinationLng),
        originAddress: form.originAddress.trim(),
        destinationAddress: form.destinationAddress.trim(),
        createdBy: isEditing ? modalTrip.createdBy : userRecord.uid,
        ...(form.scheduledDropoffAt
          ? { scheduledDropoffAt: Timestamp.fromDate(new Date(form.scheduledDropoffAt)) }
          : {}),
        ...(form.mobilityNeeds.length ? { mobilityNeeds: form.mobilityNeeds } : {}),
        ...(form.driverId ? { driverId: form.driverId } : {}),
        ...(form.vehicleId ? { vehicleId: form.vehicleId } : {}),
        ...(fareAmount !== undefined && Number.isFinite(fareAmount)
          ? { fare: { amount: fareAmount, currency: form.fareCurrency.trim() || 'USD' } }
          : {}),
        ...(distanceMiles !== undefined && Number.isFinite(distanceMiles) ? { distanceMiles } : {}),
        ...(estimatedMinutes !== undefined && Number.isFinite(estimatedMinutes)
          ? { estimatedMinutes }
          : {}),
        ...(form.brokerId.trim() ? { brokerId: form.brokerId.trim() } : {}),
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      }

      if (isEditing) {
        await updateTrip(modalTrip.tripId, payload)
      } else {
        await createTrip(payload)
      }
      closeModal()
    } catch (error) {
      setFormError(toUserMessage(error, 'Could not save this trip.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleStatusChange(tripId: string, status: TripStatus) {
    setActionError(null)
    setPendingId(tripId)
    try {
      await setTripStatus(tripId, status)
    } catch (error) {
      setActionError(toUserMessage(error, 'Could not update that trip’s status.'))
    } finally {
      setPendingId(null)
    }
  }

  async function handleDelete(tripId: string) {
    setActionError(null)
    setPendingId(tripId)
    try {
      await deleteTrip(tripId)
      if (userRecord && organizationId) {
        void writeAuditLog({
          organizationId,
          action: 'trip.deleted',
          actorId: userRecord.uid,
          actorRole: userRecord.role,
          targetCollection: 'trips',
          targetId: tripId,
        })
      }
      setConfirmDeleteId(null)
    } catch (error) {
      setActionError(toUserMessage(error, 'Could not delete that trip.'))
    } finally {
      setPendingId(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Trips"
        description="Trip scheduling, routing, and status."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add trip
          </Button>
        }
      />

      {!mapsConfigured && (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Google Maps isn't configured (VITE_GOOGLE_MAPS_API_KEY) — enter latitude/longitude manually below.
        </p>
      )}
      {actionError && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{actionError}</p>
      )}

      <div className="mt-6">
        <Card title="All trips" subtitle={trips ? `${trips.length} trip${trips.length === 1 ? '' : 's'}` : undefined}>
          {loadError ? (
            <p className="text-sm text-red-600">{loadError}</p>
          ) : trips === null ? (
            <p className="text-sm text-slate-500">Loading trips…</p>
          ) : trips.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title="No trips yet"
              description="Schedule your first trip to get started."
              action={<Button onClick={openCreate}>Add trip</Button>}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-medium uppercase tracking-wide text-slate-400">
                    <th className="pb-3 pr-4">Pickup</th>
                    <th className="pb-3 pr-4">Route</th>
                    <th className="pb-3 pr-4">Driver</th>
                    <th className="pb-3 pr-4">Vehicle</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {trips.map((trip) => {
                    const isPending = pendingId === trip.tripId
                    return (
                      <tr key={trip.tripId}>
                        <td className="py-3 pr-4 text-slate-600">
                          {trip.scheduledPickupAt.toDate().toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="max-w-xs py-3 pr-4 text-slate-600">
                          <div className="truncate">{trip.originAddress}</div>
                          <div className="truncate text-xs text-slate-400">→ {trip.destinationAddress}</div>
                        </td>
                        <td className="py-3 pr-4 text-slate-600">{driverName(trip.driverId)}</td>
                        <td className="py-3 pr-4 text-slate-600">{vehicleName(trip.vehicleId)}</td>
                        <td className="py-3 pr-4">
                          <select
                            value={trip.status}
                            disabled={isPending}
                            onChange={(event) =>
                              handleStatusChange(trip.tripId, event.target.value as TripStatus)
                            }
                            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700 focus:border-blue-500 focus:outline-none disabled:opacity-60"
                          >
                            {STATUS_OPTIONS.map((status) => (
                              <option key={status} value={status}>
                                {status.replace(/_/g, ' ')}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="secondary" size="sm" onClick={() => openEdit(trip)}>
                              Edit
                            </Button>
                            {canDelete &&
                              (confirmDeleteId === trip.tripId ? (
                                <>
                                  <Button
                                    variant="danger"
                                    size="sm"
                                    loading={isPending}
                                    onClick={() => handleDelete(trip.tripId)}
                                  >
                                    Confirm
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(null)}>
                                    Cancel
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setConfirmDeleteId(trip.tripId)}
                                >
                                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                                </Button>
                              ))}
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

      <Modal open={modalTrip !== null} onClose={closeModal} title={isEditing ? 'Edit trip' : 'Add trip'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <TextField
              label="Scheduled pickup"
              type="datetime-local"
              value={form.scheduledPickupAt}
              onChange={(v) => updateField('scheduledPickupAt', v)}
              required
            />
            <TextField
              label="Scheduled dropoff (optional)"
              type="datetime-local"
              value={form.scheduledDropoffAt}
              onChange={(v) => updateField('scheduledDropoffAt', v)}
            />
          </div>

          <AddressField
            label="Origin address"
            address={form.originAddress}
            lat={form.originLat}
            lng={form.originLng}
            verified={form.originVerified}
            verifying={verifyingOrigin}
            note={originNote}
            mapsConfigured={mapsConfigured}
            onAddressChange={(v) => handleAddressChange('origin', v)}
            onLatChange={(v) => updateField('originLat', v)}
            onLngChange={(v) => updateField('originLng', v)}
            onVerify={() => verifyAddress('origin')}
          />

          <AddressField
            label="Destination address"
            address={form.destinationAddress}
            lat={form.destinationLat}
            lng={form.destinationLng}
            verified={form.destinationVerified}
            verifying={verifyingDestination}
            note={destinationNote}
            mapsConfigured={mapsConfigured}
            onAddressChange={(v) => handleAddressChange('destination', v)}
            onLatChange={(v) => updateField('destinationLat', v)}
            onLngChange={(v) => updateField('destinationLng', v)}
            onVerify={() => verifyAddress('destination')}
          />

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Mobility needs</label>
            <div className="flex flex-wrap gap-3">
              {MOBILITY_OPTIONS.map((need) => (
                <label key={need} className="flex items-center gap-1.5 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={form.mobilityNeeds.includes(need)}
                    onChange={() => toggleMobility(need)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  {need}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Driver</label>
              <select
                value={form.driverId}
                onChange={(event) => updateField('driverId', event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
              >
                <option value="">Unassigned</option>
                {/* value is the driver's Auth uid (DriverRecord.userId), not
                    DriverRecord.driverId -- see driverName() above. Only
                    drivers with a linked login can be assigned, since the
                    trip has to be reachable by that driver in the app. */}
                {drivers
                  .filter((d) => Boolean(d.userId))
                  .map((d) => (
                    <option key={d.driverId} value={d.userId}>
                      {d.firstName} {d.lastName}
                    </option>
                  ))}
              </select>
              {drivers.some((d) => !d.userId) && (
                <p className="mt-1 text-xs text-slate-400">
                  Some drivers aren't shown — they have no linked login yet (add one on the Drivers page).
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Vehicle</label>
              <select
                value={form.vehicleId}
                onChange={(event) => updateField('vehicleId', event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
              >
                <option value="">Unassigned</option>
                {vehicles.map((v) => (
                  <option key={v.vehicleId} value={v.vehicleId}>
                    {v.year} {v.make} {v.model} ({v.plate})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
            <select
              value={form.status}
              onChange={(event) => updateField('status', event.target.value as TripStatus)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <TextField
              label="Fare amount"
              type="number"
              value={form.fareAmount}
              onChange={(v) => updateField('fareAmount', v)}
            />
            <TextField
              label="Currency"
              value={form.fareCurrency}
              onChange={(v) => updateField('fareCurrency', v)}
            />
            <TextField
              label="Broker ID"
              value={form.brokerId}
              onChange={(v) => updateField('brokerId', v)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <TextField
              label="Distance (miles)"
              type="number"
              value={form.distanceMiles}
              onChange={(v) => updateField('distanceMiles', v)}
            />
            <TextField
              label="Estimated minutes"
              type="number"
              value={form.estimatedMinutes}
              onChange={(v) => updateField('estimatedMinutes', v)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
            <textarea
              value={form.notes}
              onChange={(event) => updateField('notes', event.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{formError}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              {isEditing ? 'Save changes' : 'Add trip'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}

function AddressField({
  label,
  address,
  lat,
  lng,
  verified,
  verifying,
  note,
  mapsConfigured,
  onAddressChange,
  onLatChange,
  onLngChange,
  onVerify,
}: {
  label: string
  address: string
  lat: string
  lng: string
  verified: boolean
  verifying: boolean
  note: string | null
  mapsConfigured: boolean
  onAddressChange: (value: string) => void
  onLatChange: (value: string) => void
  onLngChange: (value: string) => void
  onVerify: () => void
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <div className="flex gap-2">
        <input
          type="text"
          value={address}
          required
          onChange={(event) => onAddressChange(event.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
        />
        {mapsConfigured && (
          <Button type="button" variant="secondary" size="sm" onClick={onVerify} loading={verifying}>
            Verify
          </Button>
        )}
      </div>
      {mapsConfigured ? (
        note && (
          <p className={`mt-1 text-xs ${verified ? 'text-emerald-600' : 'text-amber-600'}`}>
            {verifying && <Loader2 className="mr-1 inline h-3 w-3 animate-spin" aria-hidden="true" />}
            {note}
          </p>
        )
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <TextField label="Latitude" type="number" value={lat} onChange={onLatChange} required />
          <TextField label="Longitude" type="number" value={lng} onChange={onLngChange} required />
        </div>
      )}
    </div>
  )
}
