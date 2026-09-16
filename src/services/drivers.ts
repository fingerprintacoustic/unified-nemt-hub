import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type QuerySnapshot,
} from 'firebase/firestore'
import { getFirestore } from '../lib/firebase'
import type { DriverRecord, DriverStatus } from '../types'

const DRIVERS_COLLECTION = 'drivers'

function driversRef() {
  return collection(getFirestore(), DRIVERS_COLLECTION)
}

export function driverDocRef(driverId: string) {
  return doc(driversRef(), driverId)
}

/**
 * Live list of every driver in an organization. Staff-only per
 * firestore.rules (isStaff() && sameOrg(...)). Sorted client-side, like
 * observeOrgUsers, so this doesn't need a new composite Firestore index.
 */
export function observeOrgDrivers(
  organizationId: string,
  onData: (records: DriverRecord[]) => void,
  onError?: (error: unknown) => void,
): () => void {
  const q = query(driversRef(), where('organizationId', '==', organizationId))
  return onSnapshot(q, {
    next: (snapshot: QuerySnapshot) => {
      const records = snapshot.docs.map((d) => d.data() as DriverRecord)
      records.sort((a, b) =>
        `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`),
      )
      onData(records)
    },
    error: onError,
  })
}

export type NewDriverInput = Omit<DriverRecord, 'driverId' | 'createdAt' | 'updatedAt'>

export async function createDriver(input: NewDriverInput): Promise<string> {
  const ref = doc(driversRef())
  await setDoc(ref, {
    ...input,
    driverId: ref.id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export type DriverPatch = Partial<
  Omit<DriverRecord, 'driverId' | 'organizationId' | 'createdAt' | 'updatedAt'>
>

export async function updateDriver(driverId: string, patch: DriverPatch): Promise<void> {
  await updateDoc(driverDocRef(driverId), { ...patch, updatedAt: serverTimestamp() })
}

export async function setDriverStatus(driverId: string, status: DriverStatus): Promise<void> {
  await updateDoc(driverDocRef(driverId), { status, updatedAt: serverTimestamp() })
}

export async function deleteDriver(driverId: string): Promise<void> {
  await deleteDoc(driverDocRef(driverId))
}
