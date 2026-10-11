import { getFunctions, httpsCallable } from 'firebase/functions'
import { getFirebaseApp } from '../lib/firebase'
import type { UserRole } from '../types'

export interface InviteInput {
  email: string
  firstName: string
  lastName: string
  role: UserRole
  // Required by the server only when role is DRIVER.
  phone?: string
  licenseNumber?: string
  licenseState?: string
  /** YYYY-MM-DD */
  licenseExpiry?: string
}

/**
 * Creates a login in the caller's own organization via the `inviteUser`
 * cloud function (a browser cannot create someone else's Firebase Auth
 * account). The server re-checks who may invite which role -- the options
 * the form offers are a convenience, not the enforcement.
 */
export async function inviteUser(input: InviteInput): Promise<{ uid: string }> {
  const call = httpsCallable<InviteInput, { uid: string }>(getFunctions(getFirebaseApp(), 'us-central1'), 'inviteUser')
  const result = await call(input)
  return result.data
}

/** Roles each role may invite. Mirrors functions/invite.js; the server is authoritative. */
export function invitableRoles(role: UserRole | undefined): UserRole[] {
  if (role === 'ADMIN') return ['ADMIN', 'MANAGER', 'DISPATCHER', 'DRIVER']
  if (role === 'MANAGER') return ['DISPATCHER', 'DRIVER']
  return []
}
