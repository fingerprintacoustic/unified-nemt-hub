import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { TextField } from '../../components/ui/TextField'
import { formatRole } from '../../lib/format'
import type { UserRole } from '../../types'
import { selectClass } from './helpers'
import { useDemo } from './store'

interface Props {
  open: boolean
  onClose: () => void
  roles: UserRole[]
}

/** Demo version of the real Invite user form: same fields and role rule, but
 * nothing is sent anywhere -- it only adds a row to the in-memory team list. */
export function DemoInviteModal({ open, onClose, roles }: Props) {
  const { dispatch, notify } = useDemo()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>(roles.includes('DISPATCHER') ? 'DISPATCHER' : roles[0])

  function close() {
    setName('')
    setEmail('')
    onClose()
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    dispatch({ type: 'inviteUser', name: name.trim(), role })
    notify(`Invite sent to ${email.trim()}. In the real app they get an email to choose their own password.`)
    close()
  }

  return (
    <Modal open={open} onClose={close} title="Invite a user">
      <form onSubmit={submit} className="space-y-4">
        <TextField label="Full name" value={name} onChange={setName} required />
        <TextField label="Email" type="email" value={email} onChange={setEmail} required />
        <div>
          <label htmlFor="demo-invite-role" className="mb-1 block text-sm font-medium text-slate-700">
            Role
          </label>
          <select
            id="demo-invite-role"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className={`${selectClass} w-full`}
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {formatRole(r)}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-slate-400">
          They get an email with a link to choose their own password. You never see or set it. (Demo: no email is actually sent.)
        </p>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit">Send invite</Button>
        </div>
      </form>
    </Modal>
  )
}
