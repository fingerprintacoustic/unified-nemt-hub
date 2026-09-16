import { useEffect, useState } from 'react'
import { AlertTriangle, ClipboardCheck, ShieldCheck, Trash2 } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Modal } from '../../components/ui/Modal'
import { PageHeader } from '../../components/ui/PageHeader'
import { useAuth } from '../../context/AuthContext'
import { toUserMessage } from '../../lib/errors'
import { formatDateTime } from '../../lib/format'
import {
  deleteInspection,
  observeOrgInspections,
  reviewInspection,
} from '../../services/inspections'
import { observeOrgUsers } from '../../services/users'
import { observeOrgVehicles, setVehicleLastInspection } from '../../services/vehicles'
import type { InspectionRecord, UserRecord, VehicleRecord } from '../../types'

const statusBadgeTone: Record<InspectionRecord['status'], 'neutral' | 'blue' | 'green' | 'red'> = {
  DRAFT: 'neutral',
  SUBMITTED: 'blue',
  APPROVED: 'green',
  FLAGGED: 'red',
}

export function InspectionsPage() {
  const { userRecord } = useAuth()
  const organizationId = userRecord?.organizationId
  const canDelete = userRecord?.role === 'ADMIN'

  const [inspections, setInspections] = useState<InspectionRecord[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [drivers, setDrivers] = useState<UserRecord[]>([])
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([])

  const [detail, setDetail] = useState<InspectionRecord | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (!organizationId) return
    const unsubscribe = observeOrgInspections(
      organizationId,
      (records) => {
        setInspections(records)
        setLoadError(null)
      },
      (error) => setLoadError(toUserMessage(error, 'Could not load inspections for your organization.')),
    )
    return unsubscribe
  }, [organizationId])

  useEffect(() => {
    if (!organizationId) return
    const unsubUsers = observeOrgUsers(organizationId, setDrivers)
    const unsubVehicles = observeOrgVehicles(organizationId, setVehicles)
    return () => {
      unsubUsers()
      unsubVehicles()
    }
  }, [organizationId])

  function driverName(uid: string): string {
    const d = drivers.find((x) => x.uid === uid)
    return d ? `${d.firstName} ${d.lastName}` : 'Unknown driver'
  }

  function vehicleName(vehicleId: string): string {
    const v = vehicles.find((x) => x.vehicleId === vehicleId)
    return v ? `${v.year} ${v.make} ${v.model} (${v.plate})` : 'Unknown vehicle'
  }

  async function handleReview(inspection: InspectionRecord, status: 'APPROVED' | 'FLAGGED') {
    if (!userRecord) return
    setActionError(null)
    setPendingId(inspection.inspectionId)
    try {
      await reviewInspection(inspection.inspectionId, status, userRecord.uid)
      if (status === 'APPROVED') {
        // Vehicle writes are staff-only in firestore.rules -- a driver
        // submitting an inspection can't bump this themself, so it happens
        // here at the point staff signs off on it.
        await setVehicleLastInspection(inspection.vehicleId, inspection.occurredAt)
      }
      setDetail(null)
    } catch (error) {
      setActionError(toUserMessage(error, 'Could not update this inspection.'))
    } finally {
      setPendingId(null)
    }
  }

  async function handleDelete(inspectionId: string) {
    setActionError(null)
    setPendingId(inspectionId)
    try {
      await deleteInspection(inspectionId)
      setConfirmDeleteId(null)
      setDetail(null)
    } catch (error) {
      setActionError(toUserMessage(error, 'Could not delete this inspection.'))
    } finally {
      setPendingId(null)
    }
  }

  return (
    <>
      <PageHeader title="Inspections" description="Pre-trip and post-trip vehicle inspections submitted by drivers." />

      {actionError && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{actionError}</p>
      )}

      <div className="mt-6">
        <Card
          title="All inspections"
          subtitle={inspections ? `${inspections.length} inspection${inspections.length === 1 ? '' : 's'}` : undefined}
        >
          {loadError ? (
            <p className="text-sm text-red-600">{loadError}</p>
          ) : inspections === null ? (
            <p className="text-sm text-slate-500">Loading inspections…</p>
          ) : inspections.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title="No inspections yet"
              description="Driver-submitted pre-trip and post-trip inspections will appear here."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-medium uppercase tracking-wide text-slate-400">
                    <th className="pb-3 pr-4">Date</th>
                    <th className="pb-3 pr-4">Vehicle</th>
                    <th className="pb-3 pr-4">Driver</th>
                    <th className="pb-3 pr-4">Type</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inspections.map((inspection) => (
                    <tr key={inspection.inspectionId}>
                      <td className="py-3 pr-4 text-slate-600">
                        {formatDateTime(inspection.occurredAt.toDate())}
                      </td>
                      <td className="py-3 pr-4 text-slate-600">{vehicleName(inspection.vehicleId)}</td>
                      <td className="py-3 pr-4 text-slate-600">{driverName(inspection.driverId)}</td>
                      <td className="py-3 pr-4 text-slate-600">
                        {inspection.type === 'PRE_TRIP' ? 'Pre-trip' : 'Post-trip'}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-1.5">
                          <Badge tone={statusBadgeTone[inspection.status]}>{inspection.status}</Badge>
                          {inspection.flagged && <AlertTriangle className="h-4 w-4 text-red-500" aria-hidden="true" />}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <Button variant="secondary" size="sm" onClick={() => setDetail(inspection)}>
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Modal open={detail !== null} onClose={() => setDetail(null)} title="Inspection detail">
        {detail && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-400">Vehicle</p>
                <p className="text-slate-700">{vehicleName(detail.vehicleId)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Driver</p>
                <p className="text-slate-700">{driverName(detail.driverId)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">When</p>
                <p className="text-slate-700">{formatDateTime(detail.occurredAt.toDate())}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Odometer</p>
                <p className="text-slate-700">
                  {detail.odometerMiles !== undefined ? `${detail.odometerMiles.toLocaleString()} mi` : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">GPS</p>
                <p className="text-slate-700">
                  {detail.gpsLocation
                    ? `${detail.gpsLocation.latitude.toFixed(5)}, ${detail.gpsLocation.longitude.toFixed(5)}`
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Driver confirmation</p>
                <p className="text-slate-700">{detail.driverConfirmation ? 'Confirmed' : 'Not confirmed'}</p>
              </div>
            </div>

            {detail.condition && (
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Condition</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {(['exterior', 'interior', 'tires', 'brakes', 'fluids'] as const).map((key) => (
                    <div key={key} className="rounded-lg bg-slate-50 px-2 py-1.5">
                      <p className="text-[11px] uppercase text-slate-400">{key}</p>
                      <p className="text-slate-700">{detail.condition?.[key]}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Safety equipment: {detail.condition.safetyEquipment ? 'Present' : 'Missing/not functional'}
                </p>
              </div>
            )}

            {detail.damageNotes.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Damage notes</p>
                <ul className="space-y-1.5">
                  {detail.damageNotes.map((note, i) => (
                    <li key={i} className="rounded-lg bg-slate-50 px-3 py-2">
                      <span className="font-medium text-slate-700">{note.area}</span>{' '}
                      <Badge tone={note.severity === 'SEVERE' ? 'red' : note.severity === 'MODERATE' ? 'amber' : 'neutral'}>
                        {note.severity}
                      </Badge>
                      <p className="mt-1 text-slate-600">{note.description}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {detail.media.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Media</p>
                <div className="grid grid-cols-3 gap-2">
                  {detail.media.map((item, i) =>
                    item.type === 'PHOTO' ? (
                      <a key={i} href={item.url} target="_blank" rel="noreferrer">
                        <img src={item.url} alt="" className="h-20 w-full rounded-lg object-cover" />
                      </a>
                    ) : (
                      <a
                        key={i}
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex h-20 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-500 underline"
                      >
                        Video
                      </a>
                    ),
                  )}
                </div>
              </div>
            )}

            {detail.reviewedBy && (
              <p className="text-xs text-slate-400">
                Reviewed by {driverName(detail.reviewedBy)}
                {detail.reviewedAt ? ` · ${formatDateTime(detail.reviewedAt.toDate())}` : ''}
              </p>
            )}

            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
              {canDelete &&
                (confirmDeleteId === detail.inspectionId ? (
                  <>
                    <Button
                      variant="danger"
                      size="sm"
                      loading={pendingId === detail.inspectionId}
                      onClick={() => handleDelete(detail.inspectionId)}
                    >
                      Confirm delete
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(null)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(detail.inspectionId)}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                ))}
              <Button
                variant="danger"
                size="sm"
                loading={pendingId === detail.inspectionId}
                onClick={() => handleReview(detail, 'FLAGGED')}
              >
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                Flag
              </Button>
              <Button
                size="sm"
                loading={pendingId === detail.inspectionId}
                onClick={() => handleReview(detail, 'APPROVED')}
              >
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Approve
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
