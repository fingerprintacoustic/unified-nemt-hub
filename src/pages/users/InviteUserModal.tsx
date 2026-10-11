import { useState, type FormEvent } from 'react'
import { FirebaseError } from 'firebase/app'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { TextField } from '../../components/ui/TextField'
import { formatRole } from '../../lib/format'
import { sendPasswordReset } from '../../services/auth'
import { inviteUser } from '../../services/invites'
import type { UserRole } from '../../types'

interface Props {
  open: boolean
  onClose: () => void
  roles: UserRole[]
}

interface FormState {
  firstName: string
  lastName: string
  email: string
  role: UserRole
  phone: string
  licenseNumber: string
  licenseState: string
  licenseExpiry: string
}

const blank = (roles: UserRole[]): FormState => ({
  firstName: '',
  lastName: '',
  email: '',
  role: roles.includes('DISPATCHER') ? 'DISPATCHER' : (roles[0] ?? 'DISPATCHER'),
  phone: '',
  licenseNumber: '',
  licenseState: '',
  licenseExpiry: '',
})

const selectClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none'

function inviteErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError && error.code.startsWith('functions/') && error.code !== 'functions/internal') {
    return error.message
  }
  return 'Could not send that invite. Nothing was saved. Please try again.'
}

export function InviteUserModal({ open, onClose, roles }: Props) {
  const [form, setForm] = useState<FormState>(() => blank(roles))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<{ email: string; emailOk: boolean } | null>(null)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))

  function close() {
    setForm(blank(roles))
    setError(null)
    setSentTo(null)
    onClose()
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await inviteUser({
        email: form.email,
        firstName: form.firstName,
        lastName: form.lastName,
        role: form.role,
        ...(form.role === 'DRIVER'
          ? { phone: form.phone, licenseNumber: form.licenseNumber, licenseState: form.licenseState, licenseExpiry: form.licenseExpiry }
          : {}),
      })
      let emailOk = true
      try {
        await sendPasswordReset(form.email)
      } catch {
        emailOk = false
      }
      setSentTo({ email: form.email.trim(), emailOk })
    } catch (err) {
      setError(inviteErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function resend() {
    if (!sentTo) return
    try {
      await sendPasswordReset(sentTo.email)
      setSentTo({ ...sentTo, emailOk: true })
    } catch {
      setSentTo({ ...sentTo, emailOk: false })
    }
  }

  return (
    <Modal open={open} onClose={close} title={sentTo ? 'Invite sent' : 'Invite a user'}>
      {sentTo ? (
        <div className="space-y-4">
          <div className="flex gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
            <div className="space-y-1 text-sm text-slate-600">
              <p>
                <b className="text-slate-900">{sentTo.email}</b> now has an account.
              </p>
              {sentTo.emailOk ? (
                <p>They have been emailed a link to choose their password. It can take a minute, and may land in spam.</p>
              ) : (
                <p className="text-amber-700">The account was created, but the email could not be sent. Press Resend to try again.</p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-3">
            <Button variant="secondary" onClick={resend}>
              Resend email
            </Button>
            <Button onClick={close}>Done</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <TextField label="First name" value={form.firstName} onChange={(v) => set('firstName', v)} required />
            <TextField label="Last name" value={form.lastName} onChange={(v) => set('lastName', v)} required />
          </div>
          <TextField label="Email" type="email" value={form.email} onChange={(v) => set('email', v)} required />
          <div>
            <label htmlFor="invite-role" className="mb-1 block text-sm font-medium text-slate-700">
              Role
            </label>
            <select id="invite-role" value={form.role} onChange={(e) => set('role', e.target.value as UserRole)} className={selectClass}>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {formatRole(r)}
                </option>
              ))}
            </select>
          </div>

          {form.role === 'DRIVER' && (
            <div className="space-y-4 rounded-lg bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Drivers also go on the roster, linked to this login, so they can be assigned trips.</p>
              <TextField label="Phone" value={form.phone} onChange={(v) => set('phone', v)} required />
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <TextField label="License number" value={form.licenseNumber} onChange={(v) => set('licenseNumber', v)} required />
                </div>
                <TextField label="State" value={form.licenseState} onChange={(v) => set('licenseState', v)} placeholder="IL" required />
              </div>
              <TextField label="License expiry" type="date" value={form.licenseExpiry} onChange={(v) => set('licenseExpiry', v)} required />
            </div>
          )}

          <p className="text-xs text-slate-400">They will get an email with a link to choose their own password. You never see or set it.</p>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Send invite
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
