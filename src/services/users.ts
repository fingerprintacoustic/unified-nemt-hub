import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentSnapshot,
  type QuerySnapshot,
} from 'firebase/firestore'
import { getFirestore } from '../lib/firebase'
import type { UserRecord, UserRole, UserStatus } from '../types'

const USERS_COLLECTION = 'users'

function usersRef() {
  return collection(getFirestore(), USERS_COLLECTION)
}

export function userDocRef(uid: string) {
  return doc(usersRef(), uid)
}

export async function getUserRecord(uid: string): Promise<UserRecord | null> {
  const snapshot = await getDoc(userDocRef(uid))
  return snapshot.exists() ? (snapshot.data() as UserRecord) : null
}

export function observeUserRecord(
  uid: string,
  onData: (record: UserRecord | null) => void,
  onError?: (error: unknown) => void,
): () => void {
  return onSnapshot(userDocRef(uid), {
    next: (snapshot: DocumentSnapshot) => {
      onData(snapshot.exists() ? (snapshot.data() as UserRecord) : null)
    },
    error: onError,
  })
}

export async function listUsersByRole(
  organizationId: string,
  role?: UserRole,
): Promise<UserRecord[]> {
  const q = role
    ? query(
        usersRef(),
        where('organizationId', '==', organizationId),
        where('role', '==', role),
      )
    : query(usersRef(), where('organizationId', '==', organizationId))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => d.data() as UserRecord)
}

/**
 * Server-side (Cloud Function) writes user documents after Firebase Auth
 * creation — the client never creates user records directly. This helper is kept
 * for onboarding/admin flows that may temporarily write during local emulator dev.
 */
export async function upsertUserRecord(
  user: Partial<UserRecord> & { uid: string; organizationId: string; role: UserRole },
): Promise<void> {
  await setDoc(userDocRef(user.uid), { ...user, updatedAt: new Date() }, { merge: true })
}

/**
 * Live list of every user in an organization, for the Users admin screen.
 * Staff-only per firestore.rules (isStaff() && sameOrg(...)). Sorted by name
 * client-side (rather than an orderBy clause) so this doesn't need a new
 * composite Firestore index just to list a page of users.
 */
export function observeOrgUsers(
  organizationId: string,
  onData: (records: UserRecord[]) => void,
  onError?: (error: unknown) => void,
): () => void {
  const q = query(usersRef(), where('organizationId', '==', organizationId))
  return onSnapshot(q, {
    next: (snapshot: QuerySnapshot) => {
      const records = snapshot.docs.map((d) => d.data() as UserRecord)
      records.sort((a, b) =>
        `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`),
      )
      onData(records)
    },
    error: onError,
  })
}

/**
 * Change another user's role. Only an ADMIN may do this (firestore.rules), and
 * only for a user other than themself — self-role-changes are rejected by the
 * rules regardless of caller, so this is never used on the caller's own uid.
 */
export async function updateUserRole(uid: string, role: UserRole): Promise<void> {
  await updateDoc(userDocRef(uid), { role, updatedAt: serverTimestamp() })
}

/**
 * Activate or deactivate a user (firestore.rules: any staff member may change
 * another user's status within their own org, so long as role/organizationId
 * are left unchanged).
 */
export async function setUserStatus(uid: string, status: UserStatus): Promise<void> {
  await updateDoc(userDocRef(uid), { status, updatedAt: serverTimestamp() })
}