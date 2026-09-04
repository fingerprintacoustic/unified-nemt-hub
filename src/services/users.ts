import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
  type DocumentSnapshot,
} from 'firebase/firestore'
import { getFirestore } from '../lib/firebase'
import type { UserRecord, UserRole } from '../types'

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