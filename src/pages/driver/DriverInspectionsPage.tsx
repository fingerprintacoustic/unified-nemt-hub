import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { GeoPoint, Timestamp } from 'firebase/firestore'
import { AlertTriangle, Loader2, MapPin, Plus, Trash2 } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { TextField } from '../../components/ui/TextField'
import { PageHeader } from '../../components/ui/PageHeader'
import { useAuth } from '../../context/AuthContext'
import { toUserMessage } from '../../lib/errors'
import {
  createInspection,
  newInspectionId,
  observeMyInspections,
  type NewInspectionInput,
} from '../../services/inspections'
import { observeOrgVehicles } from '../../services/vehicles'
import { observeMyTrips } from '../../services/trips'
import { resolveUploadResult, uploadMedia } from '../../services/storage'
import type {
  DamageNote,
  InspectionRecord,
  InspectionType,
  TripRecord,
  VehicleRecord,
} from '../../types'

type ConditionRating = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR'
const RATING_OPTIONS: ConditionRating[] = ['EXCELLENT', 'GOOD', 'FAIR', 'POOR']
const CONDITION_FIELDS: { key: 'exterior' | 'interior' | 'tires' | 'brakes' | 'fluids'; label: string }[] = [
  { key: 'exterior', label: 'Exterior' },
  { key: 'interior', label: 'Interior' },
  { key: 'tires', label: 'Tires' },
  { key: 'brakes', label: 'Brakes' },
  { key: 'fluids', label: 'Fluids' },
]

const statusBadgeTone: Record<InspectionRecord['status'], 'neutral' | 'blue' | 'green' | 'red'> = {
  DRAFT: 'neutral',
  SUBMITTED: 'blue',
  APPROVED: 'green',
  FLAGGED: 'red',
}

interface DamageNoteDraft {
  area: string
  severity: DamageNote['severity']
  description: string
}

function toDateTimeInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function DriverInspectionsPage() {
  const { user, userRecord } = useAuth()
  const driverUid = user?.uid
  const organizationId = userRecord?.organizationId

  const [vehicles, setVehicles] = useState<VehicleRecord[]>([])
  const [myTrips, setMyTrips] = useState<TripRecord[]>([])
  const [history, setHistory] = useState<InspectionRecord[] | null>(null)

  const [type, setType] = useState<InspectionType>('PRE_TRIP')
  const [vehicleId, setVehicleId] = useState('')
  const [tripId, setTripId] = useState('')
  const [occurredAt, setOccurredAt] = useState(() => toDateTimeInputValue(new Date()))
  const [odometerMiles, setOdometerMiles] = useState('')
  const [condition, setCondition] = useState<Record<string, ConditionRating>>({
    exterior: 'GOOD',
    interior: 'GOOD',
    tires: 'GOOD',
    brakes: 'GOOD',
    fluids: 'GOOD',
  })
  const [safetyEquipment, setSafetyEquipment] = useState(true)
  const [damageNotes, setDamageNotes] = useState<DamageNoteDraft[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [driverConfirmation, setDriverConfirmation] = useState(false)

  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [gpsLoading, setGpsLoading] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!organizationId) return
    return observeOrgVehicles(organizationId, setVehicles)
  }, [organizationId])

  useEffect(() => {
    if (!driverUid) return
    return observeMyTrips(driverUid, setMyTrips)
  }, [driverUid])

  useEffect(() => {
    if (!driverUid) return
    return observeMyInspections(driverUid, setHistory, (error) =>
      console.error('Could not load inspection history:', error),
    )
  }, [driverUid])

  const linkableTrips = useMemo(
    () => myTrips.filter((t) => !['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(t.status)),
    [myTrips],
  )

  function captureGps() {
    if (!navigator.geolocation) {
      setGpsError('Location is not available on this device/browser.')
      return
    }
    setGpsLoading(true)
    setGpsError(null)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGps({ lat: position.coords.latitude, lng: position.coords.longitude })
        setGpsLoading(false)
      },
      (error) => {
        setGpsError(error.message || 'Could not get your location.')
        setGpsLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  function addDamageNote() {
    setDamageNotes((prev) => [...prev, { area: '', severity: 'MINOR', description: '' }])
  }

  function updateDamageNote(index: number, patch: Partial<DamageNoteDraft>) {
    setDamageNotes((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)))
  }

  function removeDamageNote(index: number) {
    setDamageNotes((prev) => prev.filter((_, i) => i !== index))
  }

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    setFiles((prev) => [...prev, ...Array.from(event.target.files ?? [])])
    event.target.value = ''
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  function resetForm() {
    setType('PRE_TRIP')
    setVehicleId('')
    setTripId('')
    setOccurredAt(toDateTimeInputValue(new Date()))
    setOdometerMiles('')
    setCondition({ exterior: 'GOOD', interior: 'GOOD', tires: 'GOOD', brakes: 'GOOD', fluids: 'GOOD' })
    setSafetyEquipment(true)
    setDamageNotes([])
    setFiles([])
    setDriverConfirmation(false)
    setGps(null)
    setGpsError(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!organizationId || !driverUid) return
    setFormError(null)
    setSuccessMessage(null)

    if (!vehicleId) {
      setFormError('Select a vehicle.')
      return
    }
    if (!occurredAt) {
      setFormError('Set when this inspection happened.')
      return
    }
    if (!driverConfirmation) {
      setFormError('Confirm the inspection is accurate before submitting.')
      return
    }
    if (damageNotes.some((d) => !d.area.trim() || !d.description.trim())) {
      setFormError('Fill in area and description for every damage note, or remove it.')
      return
    }

    setSubmitting(true)
    try {
      const inspectionId = newInspectionId()

      const media: InspectionRecord['media'] = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        setUploadStatus(`Uploading ${i + 1} of ${files.length}…`)
        const task = uploadMedia(organizationId, 'inspection', inspectionId, type.toLowerCase(), file)
        const result = await resolveUploadResult(task)
        media.push({
          type: file.type.startsWith('video/') ? 'VIDEO' : 'PHOTO',
          url: result.url,
          storagePath: result.storagePath,
          capturedAt: Timestamp.now(),
        })
      }
      setUploadStatus(null)

      const conditionRecord = {
        exterior: condition.exterior,
        interior: condition.interior,
        tires: condition.tires,
        brakes: condition.brakes,
        fluids: condition.fluids,
        safetyEquipment,
      } as NewInspectionInput['condition']

      const flagged =
        damageNotes.some((d) => d.severity === 'SEVERE') ||
        Object.values(condition).some((v) => v === 'POOR') ||
        !safetyEquipment

      const odometer = odometerMiles.trim() ? Number(odometerMiles) : undefined

      const payload: NewInspectionInput = {
        inspectionId,
        organizationId,
        driverId: driverUid,
        vehicleId,
        type,
        status: 'SUBMITTED',
        occurredAt: Timestamp.fromDate(new Date(occurredAt)),
        condition: conditionRecord,
        damageNotes: damageNotes.map((d) => ({ ...d, photoUrls: [] })),
        media,
        driverConfirmation,
        flagged,
        ...(tripId ? { tripId } : {}),
        ...(gps ? { gpsLocation: new GeoPoint(gps.lat, gps.lng) } : {}),
        ...(odometer !== undefined && Number.isFinite(odometer) ? { odometerMiles: odometer } : {}),
      }

      await createInspection(payload)
      setSuccessMessage('Inspection submitted.')
      resetForm()
    } catch (error) {
      setUploadStatus(null)
      setFormError(toUserMessage(error, 'Could not submit this inspection.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <PageHeader title="Inspections" description="Pre-trip and post-trip vehicle inspections." />

      {successMessage && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{successMessage}</p>
      )}

      <div className="mt-4">
        <Card title="New inspection">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-2">
              {(['PRE_TRIP', 'POST_TRIP'] as InspectionType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    type === t
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {t === 'PRE_TRIP' ? 'Pre-trip' : 'Post-trip'}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Vehicle</label>
                <select
                  value={vehicleId}
                  onChange={(event) => setVehicleId(event.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Select a vehicle…</option>
                  {vehicles.map((v) => (
                    <option key={v.vehicleId} value={v.vehicleId}>
                      {v.year} {v.make} {v.model} ({v.plate})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Trip (optional)</label>
                <select
                  value={tripId}
                  onChange={(event) => setTripId(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Not tied to a trip</option>
                  {linkableTrips.map((t) => (
                    <option key={t.tripId} value={t.tripId}>
                      {t.scheduledPickupAt.toDate().toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}{' '}
                      — {t.originAddress}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                label="When"
                type="datetime-local"
                value={occurredAt}
                onChange={setOccurredAt}
                required
              />
              <TextField
                label="Odometer (miles)"
                type="number"
                value={odometerMiles}
                onChange={setOdometerMiles}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Location</label>
              <div className="flex items-center gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={captureGps} loading={gpsLoading}>
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                  Capture my location
                </Button>
                {gps && (
                  <span className="text-xs text-slate-500">
                    {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}
                  </span>
                )}
              </div>
              {gpsError && <p className="mt-1 text-xs text-amber-600">{gpsError}</p>}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Condition</label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {CONDITION_FIELDS.map((field) => (
                  <div key={field.key} className="flex items-center justify-between gap-2">
                    <span className="text-sm text-slate-600">{field.label}</span>
                    <select
                      value={condition[field.key]}
                      onChange={(event) =>
                        setCondition((prev) => ({ ...prev, [field.key]: event.target.value as ConditionRating }))
                      }
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700 focus:border-blue-500 focus:outline-none"
                    >
                      {RATING_OPTIONS.map((rating) => (
                        <option key={rating} value={rating}>
                          {rating}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={safetyEquipment}
                  onChange={(event) => setSafetyEquipment(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Safety equipment present and functional
              </label>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">Damage notes</label>
                <Button type="button" variant="ghost" size="sm" onClick={addDamageNote}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add
                </Button>
              </div>
              {damageNotes.length === 0 ? (
                <p className="text-xs text-slate-400">No damage noted.</p>
              ) : (
                <div className="space-y-3">
                  {damageNotes.map((note, index) => (
                    <div key={index} className="rounded-lg border border-slate-200 p-3">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <TextField
                          label="Area"
                          value={note.area}
                          onChange={(v) => updateDamageNote(index, { area: v })}
                        />
                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-700">Severity</label>
                          <select
                            value={note.severity}
                            onChange={(event) =>
                              updateDamageNote(index, {
                                severity: event.target.value as DamageNote['severity'],
                              })
                            }
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                          >
                            <option value="MINOR">Minor</option>
                            <option value="MODERATE">Moderate</option>
                            <option value="SEVERE">Severe</option>
                          </select>
                        </div>
                      </div>
                      <div className="mt-2">
                        <TextField
                          label="Description"
                          value={note.description}
                          onChange={(v) => updateDamageNote(index, { description: v })}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="mt-2"
                        onClick={() => removeDamageNote(index)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Photos / video</label>
              <input
                type="file"
                accept="image/*,video/*"
                capture="environment"
                multiple
                onChange={handleFileSelect}
                className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
              />
              {files.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {files.map((file, index) => (
                    <li key={`${file.name}-${index}`} className="flex items-center justify-between text-xs text-slate-500">
                      <span className="truncate">{file.name}</span>
                      <button type="button" onClick={() => removeFile(index)} className="text-red-500 hover:underline">
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {uploadStatus && (
                <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                  {uploadStatus}
                </p>
              )}
            </div>

            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={driverConfirmation}
                onChange={(event) => setDriverConfirmation(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              I confirm this inspection is accurate
            </label>

            {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{formError}</p>}

            <Button type="submit" className="w-full" loading={submitting}>
              Submit inspection
            </Button>
          </form>
        </Card>
      </div>

      {history && history.length > 0 && (
        <div className="mt-6">
          <Card title="Recent inspections">
            <ul className="divide-y divide-slate-100">
              {history.slice(0, 5).map((inspection) => (
                <li key={inspection.inspectionId} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="text-slate-700">
                      {inspection.type === 'PRE_TRIP' ? 'Pre-trip' : 'Post-trip'} ·{' '}
                      {inspection.occurredAt.toDate().toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                    {inspection.flagged && (
                      <p className="flex items-center gap-1 text-xs text-red-600">
                        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                        Flagged
                      </p>
                    )}
                  </div>
                  <Badge tone={statusBadgeTone[inspection.status]}>{inspection.status}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </>
  )
}
