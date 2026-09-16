import {
  collection,
  deleteDoc,
  deleteField,
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
import type { TripRecord, TripStatus } from '../types'

const TRIPS_COLLECTION = 'trips'

function tripsRef() {
  return collection(getFirestore(), TRIPS_COLLECTION)
}

export function tripDocRef(tripId: string) {
  return doc(tripsRef(), tripId)
}

/**
 * Live list of every trip in an organization. Staff-only per
 * firestore.rules (isStaff() && sameOrg(...)) -- a driver's own-trips view
 * is a separate, narrower query for the Driver PWA (Phase 5), not this.
 * Sorted client-side by scheduled pickup time, like the other observeOrg*
 * helpers, so this doesn't need a new composite Firestore index.
 */
export function observeOrgTrips(
  organizationId: string,
  onData: (records: TripRecord[]) => void,
  onError?: (error: unknown) => void,
): () => void {
  const q = query(tripsRef(), where('organizationId', '==', organizationId))
  return onSnapshot(q, {
    next: (snapshot: QuerySnapshot) => {
      const records = snapshot.docs.map((d) => d.data() as TripRecord)
      records.sort((a, b) => a.scheduledPickupAt.toMillis() - b.scheduledPickupAt.toMillis())
      onData(records)
    },
    error: onError,
  })
}

export type NewTripInput = Omit<TripRecord, 'tripId' | 'createdAt' | 'updatedAt'>

export async function createTrip(input: NewTripInput): Promise<string> {
  const ref = doc(tripsRef())
  await setDoc(ref, {
    ...input,
    tripId: ref.id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export type TripPatch = Partial<
  Omit<TripRecord, 'tripId' | 'organizationId' | 'createdAt' | 'updatedAt' | 'createdBy'>
>

export async function updateTrip(tripId: string, patch: TripPatch): Promise<void> {
  await updateDoc(tripDocRef(tripId), { ...patch, updatedAt: serverTimestamp() })
}

export async function setTripStatus(tripId: string, status: TripStatus): Promise<void> {
  await updateDoc(tripDocRef(tripId), { status, updatedAt: serverTimestamp() })
}

/**
 * Assign a driver + vehicle to a trip. If the trip is still SCHEDULED, also
 * bumps status to ASSIGNED -- a UI convenience (not a rule-enforced
 * transition) so the status reflects reality without an extra click; the
 * dispatcher can still override the status separately at any point.
 */
export async function assignTrip(
  tripId: string,
  driverId: string,
  vehicleId: string,
  currentStatus: TripStatus,
): Promise<void> {
  await updateDoc(tripDocRef(tripId), {
    driverId,
    vehicleId,
    ...(currentStatus === 'SCHEDULED' ? { status: 'ASSIGNED' as TripStatus } : {}),
    updatedAt: serverTimestamp(),
  })
}

/** Clears driver + vehicle assignment (does not change status). */
export async function unassignTrip(tripId: string): Promise<void> {
  await updateDoc(tripDocRef(tripId), {
    driverId: deleteField(),
    vehicleId: deleteField(),
    updatedAt: serverTimestamp(),
  })
}

export async function deleteTrip(tripId: string): Promise<void> {
  await deleteDoc(tripDocRef(tripId))
}
