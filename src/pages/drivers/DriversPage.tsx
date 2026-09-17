import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Timestamp } from 'firebase/firestore'
import { Plus, Trash2, Users as UsersIcon } from 'lucide-react'
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
  createDriver,
  deleteDriver,
  observeOrgDrivers,
  setDriverStatus,
  updateDriver,
  type NewDriverInput,
} from '../../services/drivers'
import { listUsersByRole } from '../../services/users'
import type { DriverRecord, DriverStatus, UserRecord } from '../../types'

const STATUS_OPTIONS: DriverStatus[] = ['ACTIVE', 'INACTIVE', 'ON_LEAVE']

interface DriverFormState {
  firstName: string
  lastName: string
  phone: string
  email: string
  licenseNumber: string
  licenseState: string
  licenseExpiry: string
  certificationExpiry: string
  status: DriverStatus
  userId: string
  emergencyContactName: string
  emergencyContactRelationship: string
  emergencyContactPhone: string
}

const EMPTY_FORM: DriverFormState = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  licenseNumber: '',
  licenseState: '',
  licenseExpiry: '',
  certificationExpiry: '',
  status: 'ACTIVE',
  userId: '',
  emergencyContactName: '',
  emergencyContactRelationship: '',
  emergencyContactPhone: '',
}

function toDateInputValue(value: Timestamp | undefined): string {
  if (!value) return ''
  return value.toDate().toISOString().slice(0, 10)
}

// <input type="date"> gives a plain "YYYY-MM-DD" string. Parsing that with
// `new Date(str)` treats it as UTC midnight, which then renders as the
// previous day in any timezone behind UTC. Appending a local time-of-day
// forces `Date` to parse it in the local timezone, matching what the picker
// showed.
function dateInputToTimestamp(value: string): Timestamp {
  return Timestamp.fromDate(new Date(`${value}T00:00:00`))
}

function driverToForm(driver: DriverRecord): DriverFormState {
  return {
    firstName: driver.firstName,
    lastName: driver.lastName,
    phone: driver.phone,
    email: driver.email ?? '',
    licenseNumber: driver.licenseNumber,
    licenseState: driver.licenseState,
    licenseExpiry: toDateInputValue(driver.licenseExpiry),
    certificationExpiry: toDateInputValue(driver.certificationExpiry),
    status: driver.status,
    userId: driver.userId ?? '',
    emergencyContactName: driver.emergencyContact?.name ?? '',
    emergencyContactRelationship: driver.emergencyContact?.relationship ?? '',
    emergencyContactPhone: driver.emergencyContact?.phone ?? '',
  }
}

function licenseBadge(expiry: Timestamp): { label: string; tone: 'red' | 'amber' | 'neutral' } {
  const days = (expiry.toDate().getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  if (days < 0) return { label: 'Expired', tone: 'red' }
  if (days <= 30) return { label: 'Expiring soon', tone: 'amber' }
  return { label: formatDate(expiry.toDate()), tone: 'neutral' }
}

export function DriversPage() {
  const { userRecord } = useAuth()
  const organizationId = userRecord?.organizationId
  const canDelete = userRecord?.role === 'ADMIN'

  const [drivers, setDrivers] = useState<DriverRecord[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [modalDriver, setModalDriver] = useState<DriverRecord | 'new' | null>(null)
  const [form, setForm] = useState<DriverFormState>(EMPTY_FORM)
  const [includeEmergencyContact, setIncludeEmergencyContact] = useState(false)
  const [driverUsers, setDriverUsers] = useState<UserRecord[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [pendingId, setPendingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (!organizationId) return
    const unsubscribe = observeOrgDrivers(
      organizationId,
      (records) => {
        setDrivers(records)
        setLoadError(null)
      },
      (error) => setLoadError(toUserMessage(error, 'Could not load drivers for your organization.')),
    )
    return unsubscribe
  }, [organizationId])

  const isEditing = typeof modalDriver === 'object' && modalDriver !== null

  function openCreate() {
    setForm(EMPTY_FORM)
    setIncludeEmergencyContact(false)
    setFormError(null)
    setModalDriver('new')
    if (organizationId) {
      listUsersByRole(organizationId, 'DRIVER').then(setDriverUsers).catch(() => setDriverUsers([]))
    }
  }

  function openEdit(driver: DriverRecord) {
    setForm(driverToForm(driver))
    setIncludeEmergencyContact(Boolean(driver.emergencyContact))
    setFormError(null)
    setModalDriver(driver)
    if (organizationId) {
      listUsersByRole(organizationId, 'DRIVER').then(setDriverUsers).catch(() => setDriverUsers([]))
    }
  }

  function closeModal() {
    setModalDriver(null)
  }

  function updateField<K extends keyof DriverFormState>(key: K, value: DriverFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!organizationId) return
    setFormError(null)

    if (!form.firstName.trim() || !form.lastName.trim() || !form.phone.trim()) {
      setFormError('First name, last name, and phone are required.')
      return
    }
    if (!form.licenseNumber.trim() || !form.licenseState.trim() || !form.licenseExpiry) {
      setFormError('License number, state, and expiry are required.')
      return
    }
    if (
      includeEmergencyContact &&
      (!form.emergencyContactName.trim() ||
        !form.emergencyContactRelationship.trim() ||
        !form.emergencyContactPhone.trim())
    ) {
      setFormError('Fill in all three emergency contact fields, or remove it.')
      return
    }

    setSubmitting(true)
    try {
      const payload: NewDriverInput = {
        organizationId,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim(),
        licenseNumber: form.licenseNumber.trim(),
        licenseState: form.licenseState.trim().toUpperCase(),
        licenseExpiry: dateInputToTimestamp(form.licenseExpiry),
        status: form.status,
        ...(form.email.trim() ? { email: form.email.trim() } : {}),
        ...(form.certificationExpiry
          ? { certificationExpiry: dateInputToTimestamp(form.certificationExpiry) }
          : {}),
        ...(form.userId ? { userId: form.userId } : {}),
        ...(includeEmergencyContact
          ? {
              emergencyContact: {
                name: form.emergencyContactName.trim(),
                relationship: form.emergencyContactRelationship.trim(),
                phone: form.emergencyContactPhone.trim(),
              },
            }
          : {}),
      }

      if (isEditing) {
        await updateDriver(modalDriver.driverId, payload)
      } else {
        await createDriver(payload)
      }
      closeModal()
    } catch (error) {
      setFormError(toUserMessage(error, 'Could not save this driver.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleStatusChange(driverId: string, status: DriverStatus) {
    setActionError(null)
    setPendingId(driverId)
    try {
      await setDriverStatus(driverId, status)
    } catch (error) {
      setActionError(toUserMessage(error, 'Could not update that driver’s status.'))
    } finally {
      setPendingId(null)
    }
  }

  async function handleDelete(driverId: string) {
    setActionError(null)
    setPendingId(driverId)
    try {
      await deleteDriver(driverId)
      if (userRecord && organizationId) {
        void writeAuditLog({
          organizationId,
          action: 'driver.deleted',
          actorId: userRecord.uid,
          actorRole: userRecord.role,
          targetCollection: 'drivers',
          targetId: driverId,
        })
      }
      setConfirmDeleteId(null)
    } catch (error) {
      setActionError(toUserMessage(error, 'Could not delete that driver.'))
    } finally {
      setPendingId(null)
    }
  }

  const modalTitle = useMemo(
    () => (isEditing ? 'Edit driver' : 'Add driver'),
    [isEditing],
  )

  return (
    <>
      <PageHeader
        title="Drivers"
        description="Driver roster, licenses, certifications, and status."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add driver
          </Button>
        }
      />

      {actionError && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{actionError}</p>
      )}

      <div className="mt-6">
        <Card
          title="Roster"
          subtitle={drivers ? `${drivers.length} driver${drivers.length === 1 ? '' : 's'}` : undefined}
        >
          {loadError ? (
            <p className="text-sm text-red-600">{loadError}</p>
          ) : drivers === null ? (
            <p className="text-sm text-slate-500">Loading drivers…</p>
          ) : drivers.length === 0 ? (
            <EmptyState
              icon={UsersIcon}
              title="No drivers yet"
              description="Add your first driver to start building the roster."
              action={<Button onClick={openCreate}>Add driver</Button>}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-medium uppercase tracking-wide text-slate-400">
                    <th className="pb-3 pr-4">Name</th>
                    <th className="pb-3 pr-4">Phone</th>
                    <th className="pb-3 pr-4">License</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {drivers.map((driver) => {
                    const isPending = pendingId === driver.driverId
                    const license = licenseBadge(driver.licenseExpiry)
                    return (
                      <tr key={driver.driverId}>
                        <td className="py-3 pr-4 font-medium text-slate-800">
                          {driver.firstName} {driver.lastName}
                        </td>
                        <td className="py-3 pr-4 text-slate-500">{driver.phone}</td>
                        <td className="py-3 pr-4">
                          <div className="flex flex-col gap-1">
                            <span className="text-slate-600">
                              {driver.licenseNumber} ({driver.licenseState})
                            </span>
                            <Badge tone={license.tone}>{license.label}</Badge>
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <select
                            value={driver.status}
                            disabled={isPending}
                            onChange={(event) =>
                              handleStatusChange(driver.driverId, event.target.value as DriverStatus)
                            }
                            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700 focus:border-blue-500 focus:outline-none disabled:opacity-60"
                          >
                            {STATUS_OPTIONS.map((status) => (
                              <option key={status} value={status}>
                                {status.replace('_', ' ')}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="secondary" size="sm" onClick={() => openEdit(driver)}>
                              Edit
                            </Button>
                            {canDelete &&
                              (confirmDeleteId === driver.driverId ? (
                                <>
                                  <Button
                                    variant="danger"
                                    size="sm"
                                    loading={isPending}
                                    onClick={() => handleDelete(driver.driverId)}
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
                                  onClick={() => setConfirmDeleteId(driver.driverId)}
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

      <Modal open={modalDriver !== null} onClose={closeModal} title={modalTitle}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <TextField label="First name" value={form.firstName} onChange={(v) => updateField('firstName', v)} required />
            <TextField label="Last name" value={form.lastName} onChange={(v) => updateField('lastName', v)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Phone" value={form.phone} onChange={(v) => updateField('phone', v)} required />
            <TextField label="Email" type="email" value={form.email} onChange={(v) => updateField('email', v)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <TextField
              label="License number"
              value={form.licenseNumber}
              onChange={(v) => updateField('licenseNumber', v)}
              required
            />
            <TextField
              label="License state"
              value={form.licenseState}
              onChange={(v) => updateField('licenseState', v)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <TextField
              label="License expiry"
              type="date"
              value={form.licenseExpiry}
              onChange={(v) => updateField('licenseExpiry', v)}
              required
            />
            <TextField
              label="Certification expiry"
              type="date"
              value={form.certificationExpiry}
              onChange={(v) => updateField('certificationExpiry', v)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
              <select
                value={form.status}
                onChange={(event) => updateField('status', event.target.value as DriverStatus)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Linked login account</label>
              <select
                value={form.userId}
                onChange={(event) => updateField('userId', event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
              >
                <option value="">None</option>
                {driverUsers.map((u) => (
                  <option key={u.uid} value={u.uid}>
                    {u.firstName} {u.lastName} ({u.email})
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-400">
                Only users with the DRIVER role show here. Create their login via the Users page first.
              </p>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={includeEmergencyContact}
                onChange={(event) => setIncludeEmergencyContact(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Emergency contact
            </label>
            {includeEmergencyContact && (
              <div className="mt-3 grid grid-cols-3 gap-3">
                <TextField
                  label="Name"
                  value={form.emergencyContactName}
                  onChange={(v) => updateField('emergencyContactName', v)}
                />
                <TextField
                  label="Relationship"
                  value={form.emergencyContactRelationship}
                  onChange={(v) => updateField('emergencyContactRelationship', v)}
                />
                <TextField
                  label="Phone"
                  value={form.emergencyContactPhone}
                  onChange={(v) => updateField('emergencyContactPhone', v)}
                />
              </div>
            )}
          </div>

          {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{formError}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              {isEditing ? 'Save changes' : 'Add driver'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
