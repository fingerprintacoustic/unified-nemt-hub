import { useEffect, useState, type FormEvent } from 'react'
import { GeoPoint, Timestamp } from 'firebase/firestore'
import { CarFront, MapPin, Navigation, Plus, Trash2 } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Modal } from '../../components/ui/Modal'
import { PageHeader } from '../../components/ui/PageHeader'
import { TextField } from '../../components/ui/TextField'
import { useAuth } from '../../context/AuthContext'
import { toUserMessage } from '../../lib/errors'
import { formatDate, formatDateTime } from '../../lib/format'
import { geocodeAddress } from '../../services/geocoding'
import { buildDirectionsUrl } from '../../lib/navigation'
import { writeAuditLog } from '../../services/audit'
import {
  createVehicle,
  deleteVehicle,
  observeOrgVehicles,
  setVehicleStatus,
  setVehicleTelemetry,
  updateVehicle,
  type NewVehicleInput,
} from '../../services/vehicles'
import type { VehicleRecord, VehicleStatus, VehicleType } from '../../types'

const STATUS_OPTIONS: VehicleStatus[] = ['AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'OUT_OF_SERVICE']
const TYPE_OPTIONS: VehicleType[] = ['SEDAN', 'WHEELCHAIR_VAN', 'AMBULETTE', 'BUS', 'OTHER']

interface VehicleFormState {
  make: string
  model: string
  year: string
  plate: string
  vin: string
  type: VehicleType
  status: VehicleStatus
  wheelchairAccessible: boolean
  odometer: string
}

const EMPTY_FORM: VehicleFormState = {
  make: '',
  model: '',
  year: String(new Date().getFullYear()),
  plate: '',
  vin: '',
  type: 'SEDAN',
  status: 'AVAILABLE',
  wheelchairAccessible: false,
  odometer: '0',
}

function vehicleToForm(vehicle: VehicleRecord): VehicleFormState {
  return {
    make: vehicle.make,
    model: vehicle.model,
    year: String(vehicle.year),
    plate: vehicle.plate,
    vin: vehicle.vin ?? '',
    type: vehicle.type,
    status: vehicle.status,
    wheelchairAccessible: vehicle.wheelchairAccessible,
    odometer: String(vehicle.odometer),
  }
}

interface TelemetryFormState {
  address: string
  lat: string
  lng: string
  verified: boolean
  speedMph: string
  ignitionOn: boolean
}

const EMPTY_TELEMETRY_FORM: TelemetryFormState = {
  address: '',
  lat: '',
  lng: '',
  verified: false,
  speedMph: '',
  ignitionOn: false,
}

export function VehiclesPage() {
  const { userRecord } = useAuth()
  const organizationId = userRecord?.organizationId
  const canDelete = userRecord?.role === 'ADMIN'

  const [vehicles, setVehicles] = useState<VehicleRecord[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [modalVehicle, setModalVehicle] = useState<VehicleRecord | 'new' | null>(null)
  const [form, setForm] = useState<VehicleFormState>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [telemetryVehicle, setTelemetryVehicle] = useState<VehicleRecord | null>(null)
  const [telemetryForm, setTelemetryForm] = useState<TelemetryFormState>(EMPTY_TELEMETRY_FORM)
  const [verifyingAddress, setVerifyingAddress] = useState(false)
  const [addressNote, setAddressNote] = useState<string | null>(null)
  const [savingTelemetry, setSavingTelemetry] = useState(false)
  const [telemetryError, setTelemetryError] = useState<string | null>(null)

  const [pendingId, setPendingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (!organizationId) return
    const unsubscribe = observeOrgVehicles(
      organizationId,
      (records) => {
        setVehicles(records)
        setLoadError(null)
      },
      (error) => setLoadError(toUserMessage(error, 'Could not load vehicles for your organization.')),
    )
    return unsubscribe
  }, [organizationId])

  const isEditing = typeof modalVehicle === 'object' && modalVehicle !== null

  function openCreate() {
    setForm(EMPTY_FORM)
    setFormError(null)
    setModalVehicle('new')
  }

  function openEdit(vehicle: VehicleRecord) {
    setForm(vehicleToForm(vehicle))
    setFormError(null)
    setModalVehicle(vehicle)
  }

  function closeModal() {
    setModalVehicle(null)
  }

  function updateField<K extends keyof VehicleFormState>(key: K, value: VehicleFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!organizationId) return
    setFormError(null)

    if (!form.make.trim() || !form.model.trim() || !form.plate.trim()) {
      setFormError('Make, model, and plate are required.')
      return
    }
    const year = Number(form.year)
    const odometer = Number(form.odometer)
    if (!Number.isFinite(year) || year < 1980 || year > new Date().getFullYear() + 1) {
      setFormError('Enter a valid model year.')
      return
    }
    if (!Number.isFinite(odometer) || odometer < 0) {
      setFormError('Enter a valid odometer reading.')
      return
    }

    setSubmitting(true)
    try {
      const payload: NewVehicleInput = {
        organizationId,
        make: form.make.trim(),
        model: form.model.trim(),
        year,
        plate: form.plate.trim().toUpperCase(),
        type: form.type,
        status: form.status,
        wheelchairAccessible: form.wheelchairAccessible,
        odometer,
        ...(form.vin.trim() ? { vin: form.vin.trim().toUpperCase() } : {}),
      }

      if (isEditing) {
        await updateVehicle(modalVehicle.vehicleId, payload)
      } else {
        await createVehicle(payload)
      }
      closeModal()
    } catch (error) {
      setFormError(toUserMessage(error, 'Could not save this vehicle.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleStatusChange(vehicleId: string, status: VehicleStatus) {
    setActionError(null)
    setPendingId(vehicleId)
    try {
      await setVehicleStatus(vehicleId, status)
    } catch (error) {
      setActionError(toUserMessage(error, 'Could not update that vehicle’s status.'))
    } finally {
      setPendingId(null)
    }
  }

  function openTelemetry(vehicle: VehicleRecord) {
    const t = vehicle.telemetry
    setTelemetryForm({
      address: t?.positionAddress ?? '',
      lat: t?.position ? String(t.position.latitude) : '',
      lng: t?.position ? String(t.position.longitude) : '',
      verified: Boolean(t?.position),
      speedMph: t?.speedMph !== undefined ? String(t.speedMph) : '',
      ignitionOn: t?.ignitionOn ?? false,
    })
    setAddressNote(null)
    setTelemetryError(null)
    setTelemetryVehicle(vehicle)
  }

  async function verifyTelemetryAddress() {
    if (!telemetryForm.address.trim()) {
      setAddressNote('Enter an address first.')
      return
    }
    setVerifyingAddress(true)
    setAddressNote(null)
    try {
      const result = await geocodeAddress(telemetryForm.address)
      setTelemetryForm((prev) => ({ ...prev, lat: String(result.lat), lng: String(result.lng), verified: true }))
      setAddressNote(`Found: ${result.formattedAddress}`)
    } catch (error) {
      setAddressNote(error instanceof Error ? error.message : 'Could not verify that address.')
    } finally {
      setVerifyingAddress(false)
    }
  }

  async function handleSaveTelemetry() {
    if (!telemetryVehicle) return
    setTelemetryError(null)
    const speedMph = telemetryForm.speedMph.trim() ? Number(telemetryForm.speedMph) : undefined
    if (speedMph !== undefined && (!Number.isFinite(speedMph) || speedMph < 0)) {
      setTelemetryError('Enter a valid speed, or leave it blank.')
      return
    }
    if (telemetryForm.address.trim() && !telemetryForm.verified) {
      setTelemetryError('Verify the address before saving, or clear it.')
      return
    }
    setSavingTelemetry(true)
    try {
      await setVehicleTelemetry(telemetryVehicle.vehicleId, {
        ...(telemetryForm.verified
          ? {
              position: new GeoPoint(Number(telemetryForm.lat), Number(telemetryForm.lng)),
              positionAddress: telemetryForm.address.trim(),
            }
          : {}),
        ...(speedMph !== undefined ? { speedMph } : {}),
        ignitionOn: telemetryForm.ignitionOn,
        recordedAt: Timestamp.now(),
        source: 'MANUAL',
        ...(userRecord ? { updatedBy: userRecord.uid } : {}),
      })
      setTelemetryVehicle(null)
    } catch (error) {
      setTelemetryError(toUserMessage(error, 'Could not save this status update.'))
    } finally {
      setSavingTelemetry(false)
    }
  }

  async function handleDelete(vehicleId: string) {
    setActionError(null)
    setPendingId(vehicleId)
    try {
      await deleteVehicle(vehicleId)
      if (userRecord && organizationId) {
        void writeAuditLog({
          organizationId,
          action: 'vehicle.deleted',
          actorId: userRecord.uid,
          actorRole: userRecord.role,
          targetCollection: 'vehicles',
          targetId: vehicleId,
        })
      }
      setConfirmDeleteId(null)
    } catch (error) {
      setActionError(toUserMessage(error, 'Could not delete that vehicle.'))
    } finally {
      setPendingId(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Vehicles"
        description="Fleet roster: vehicle details, availability, and wheelchair accessibility."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add vehicle
          </Button>
        }
      />

      {actionError && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{actionError}</p>
      )}

      <div className="mt-6">
        <Card
          title="Fleet"
          subtitle={vehicles ? `${vehicles.length} vehicle${vehicles.length === 1 ? '' : 's'}` : undefined}
        >
          {loadError ? (
            <p className="text-sm text-red-600">{loadError}</p>
          ) : vehicles === null ? (
            <p className="text-sm text-slate-500">Loading vehicles…</p>
          ) : vehicles.length === 0 ? (
            <EmptyState
              icon={CarFront}
              title="No vehicles yet"
              description="Add your first vehicle to start building the fleet."
              action={<Button onClick={openCreate}>Add vehicle</Button>}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-medium uppercase tracking-wide text-slate-400">
                    <th className="pb-3 pr-4">Vehicle</th>
                    <th className="pb-3 pr-4">Plate</th>
                    <th className="pb-3 pr-4">Type</th>
                    <th className="pb-3 pr-4">Odometer</th>
                    <th className="pb-3 pr-4">Last inspection</th>
                    <th className="pb-3 pr-4">Last known status</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {vehicles.map((vehicle) => {
                    const isPending = pendingId === vehicle.vehicleId
                    return (
                      <tr key={vehicle.vehicleId}>
                        <td className="py-3 pr-4 font-medium text-slate-800">
                          {vehicle.year} {vehicle.make} {vehicle.model}
                          {vehicle.wheelchairAccessible && (
                            <Badge tone="blue" className="ml-2">
                              WC accessible
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-slate-500">{vehicle.plate}</td>
                        <td className="py-3 pr-4 text-slate-500">{vehicle.type.replace('_', ' ')}</td>
                        <td className="py-3 pr-4 text-slate-500">{vehicle.odometer.toLocaleString()} mi</td>
                        <td className="py-3 pr-4 text-slate-500">
                          {vehicle.lastInspectionAt ? formatDate(vehicle.lastInspectionAt.toDate()) : '—'}
                        </td>
                        <td className="py-3 pr-4">
                          {vehicle.telemetry ? (
                            <div className="flex flex-col gap-1 text-xs">
                              <div className="flex items-center gap-1.5">
                                <Badge tone={vehicle.telemetry.ignitionOn ? 'green' : 'neutral'}>
                                  {vehicle.telemetry.ignitionOn ? 'Ignition on' : 'Ignition off'}
                                </Badge>
                                {vehicle.telemetry.speedMph !== undefined && (
                                  <span className="text-slate-500">{vehicle.telemetry.speedMph} mph</span>
                                )}
                              </div>
                              <span className="text-slate-400">
                                as of {formatDateTime(vehicle.telemetry.recordedAt.toDate())}
                              </span>
                              {vehicle.telemetry.position && (
                                <a
                                  href={buildDirectionsUrl(
                                    vehicle.telemetry.position.latitude,
                                    vehicle.telemetry.position.longitude,
                                  )}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                                >
                                  <Navigation className="h-3 w-3" aria-hidden="true" />
                                  {vehicle.telemetry.positionAddress ?? 'View position'}
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">No status yet</span>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <select
                            value={vehicle.status}
                            disabled={isPending}
                            onChange={(event) =>
                              handleStatusChange(vehicle.vehicleId, event.target.value as VehicleStatus)
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
                            <Button variant="secondary" size="sm" onClick={() => openEdit(vehicle)}>
                              Edit
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => openTelemetry(vehicle)}>
                              <MapPin className="h-4 w-4" aria-hidden="true" />
                              Update status
                            </Button>
                            {canDelete &&
                              (confirmDeleteId === vehicle.vehicleId ? (
                                <>
                                  <Button
                                    variant="danger"
                                    size="sm"
                                    loading={isPending}
                                    onClick={() => handleDelete(vehicle.vehicleId)}
                                  >
                                    Confirm
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setConfirmDeleteId(null)}
                                  >
                                    Cancel
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setConfirmDeleteId(vehicle.vehicleId)}
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

      <Modal open={modalVehicle !== null} onClose={closeModal} title={isEditing ? 'Edit vehicle' : 'Add vehicle'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Make" value={form.make} onChange={(v) => updateField('make', v)} required />
            <TextField label="Model" value={form.model} onChange={(v) => updateField('model', v)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Year" type="number" value={form.year} onChange={(v) => updateField('year', v)} required />
            <TextField label="Plate" value={form.plate} onChange={(v) => updateField('plate', v)} required />
          </div>
          <TextField label="VIN" value={form.vin} onChange={(v) => updateField('vin', v)} />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Type</label>
              <select
                value={form.type}
                onChange={(event) => updateField('type', event.target.value as VehicleType)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
              >
                {TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {type.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
              <select
                value={form.status}
                onChange={(event) => updateField('status', event.target.value as VehicleStatus)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <TextField
            label="Odometer (miles)"
            type="number"
            value={form.odometer}
            onChange={(v) => updateField('odometer', v)}
            required
          />
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={form.wheelchairAccessible}
              onChange={(event) => updateField('wheelchairAccessible', event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Wheelchair accessible
          </label>

          {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{formError}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              {isEditing ? 'Save changes' : 'Add vehicle'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={telemetryVehicle !== null}
        onClose={() => setTelemetryVehicle(null)}
        title={telemetryVehicle ? `Update status: ${telemetryVehicle.year} ${telemetryVehicle.make} ${telemetryVehicle.model}` : ''}
      >
        {telemetryVehicle && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Manual entry for now -- e.g. what a driver reports over the phone. Once a real telematics
              provider is connected, this updates automatically instead.
            </p>
            <div>
              <TextField
                label="Current location (optional)"
                value={telemetryForm.address}
                onChange={(v) => {
                  setTelemetryForm((prev) => ({ ...prev, address: v, verified: false }))
                  setAddressNote(null)
                }}
                placeholder="e.g. 500 Main St, Springfield"
              />
              <div className="mt-2 flex items-center gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  loading={verifyingAddress}
                  onClick={verifyTelemetryAddress}
                >
                  Verify
                </Button>
                {addressNote && <p className="text-xs text-slate-500">{addressNote}</p>}
              </div>
            </div>
            <TextField
              label="Speed (mph, optional)"
              type="number"
              value={telemetryForm.speedMph}
              onChange={(v) => setTelemetryForm((prev) => ({ ...prev, speedMph: v }))}
            />
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={telemetryForm.ignitionOn}
                onChange={(event) => setTelemetryForm((prev) => ({ ...prev, ignitionOn: event.target.checked }))}
                className="h-4 w-4 rounded border-slate-300"
              />
              Ignition on
            </label>

            {telemetryError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{telemetryError}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => setTelemetryVehicle(null)}>
                Cancel
              </Button>
              <Button loading={savingTelemetry} onClick={handleSaveTelemetry}>
                Save status
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
