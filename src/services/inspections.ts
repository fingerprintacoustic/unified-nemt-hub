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
import type { InspectionRecord, InspectionStatus } from '../types'

const INSPECTIONS_COLLECTION = 'inspections'

function inspectionsRef() {
  return collection(getFirestore(), INSPECTIONS_COLLECTION)
}

export function inspectionDocRef(inspectionId: string) {
  return doc(inspectionsRef(), inspectionId)
}

/** Reserve a doc id up front so media can be uploaded to a stable Storage
 * path (inspections/{orgId}/{inspectionId}/...) before the Firestore
 * document itself is written. */
export function newInspectionId(): string {
  return doc(inspectionsRef()).id
}

/** Staff view: every inspection in the org, most recent first. */
export function observeOrgInspections(
  organizationId: string,
  onData: (records: InspectionRecord[]) => void,
  onError?: (error: unknown) => void,
): () => void {
  const q = query(inspectionsRef(), where('organizationId', '==', organizationId))
  return onSnapshot(q, {
    next: (snapshot: QuerySnapshot) => {
      const records = snapshot.docs.map((d) => d.data() as InspectionRecord)
      records.sort((a, b) => b.occurredAt.toMillis() - a.occurredAt.toMillis())
      onData(records)
    },
    error: onError,
  })
}

/** Driver view: only their own inspections (firestore.rules: driverId ==
 * request.auth.uid), most recent first. */
export function observeMyInspections(
  driverUid: string,
  onData: (records: InspectionRecord[]) => void,
  onError?: (error: unknown) => void,
): () => void {
  const q = query(inspectionsRef(), where('driverId', '==', driverUid))
  return onSnapshot(q, {
    next: (snapshot: QuerySnapshot) => {
      const records = snapshot.docs.map((d) => d.data() as InspectionRecord)
      records.sort((a, b) => b.occurredAt.toMillis() - a.occurredAt.toMillis())
      onData(records)
    },
    error: onError,
  })
}

export type NewInspectionInput = Omit<InspectionRecord, 'createdAt' | 'updatedAt'>

export async function createInspection(input: NewInspectionInput): Promise<void> {
  await setDoc(inspectionDocRef(input.inspectionId), {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

/** Staff review action: approve or flag, recording who/when. */
export async function reviewInspection(
  inspectionId: string,
  status: Extract<InspectionStatus, 'APPROVED' | 'FLAGGED'>,
  reviewerUid: string,
): Promise<void> {
  await updateDoc(inspectionDocRef(inspectionId), {
    status,
    flagged: status === 'FLAGGED',
    reviewedBy: reviewerUid,
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function deleteInspection(inspectionId: string): Promise<void> {
  await deleteDoc(inspectionDocRef(inspectionId))
}
