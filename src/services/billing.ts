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
import type { BillingLineItem, BillingPeriodRecord, BillingPeriodStatus, Money, Timestamp } from '../types'

const BILLING_COLLECTION = 'billingPeriods'

function billingRef() {
  return collection(getFirestore(), BILLING_COLLECTION)
}

export function billingDocRef(periodId: string) {
  return doc(billingRef(), periodId)
}

/** Live list of every billing period in an organization, most recent first. */
export function observeOrgBillingPeriods(
  organizationId: string,
  onData: (records: BillingPeriodRecord[]) => void,
  onError?: (error: unknown) => void,
): () => void {
  const q = query(billingRef(), where('organizationId', '==', organizationId))
  return onSnapshot(q, {
    next: (snapshot: QuerySnapshot) => {
      const records = snapshot.docs.map((d) => d.data() as BillingPeriodRecord)
      records.sort((a, b) => b.startDate.toMillis() - a.startDate.toMillis())
      onData(records)
    },
    error: onError,
  })
}

export async function createBillingPeriod(input: {
  organizationId: string
  startDate: Timestamp
  endDate: Timestamp
  brokerId?: string
  createdBy: string
}): Promise<string> {
  const ref = doc(billingRef())
  await setDoc(ref, {
    periodId: ref.id,
    organizationId: input.organizationId,
    startDate: input.startDate,
    endDate: input.endDate,
    ...(input.brokerId ? { brokerId: input.brokerId } : {}),
    status: 'DRAFT' as BillingPeriodStatus,
    lineItems: [],
    totalAmount: { amount: 0, currency: 'USD' } as Money,
    createdBy: input.createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

/** Snapshots the currently-matching trips into lineItems/totalAmount and
 * locks the period so numbers already exported don't shift under a later
 * trip edit. */
export async function finalizeBillingPeriod(
  periodId: string,
  lineItems: BillingLineItem[],
  totalAmount: Money,
  finalizedBy: string,
): Promise<void> {
  await updateDoc(billingDocRef(periodId), {
    lineItems,
    totalAmount,
    status: 'FINALIZED' as BillingPeriodStatus,
    finalizedBy,
    finalizedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

/** Sends an already-finalized period back to DRAFT for corrections. */
export async function reopenBillingPeriod(periodId: string): Promise<void> {
  await updateDoc(billingDocRef(periodId), { status: 'DRAFT' as BillingPeriodStatus, updatedAt: serverTimestamp() })
}

/** Marks a period exported. The CSV itself is generated client-side from
 * the finalized lineItems -- this just records that it happened. */
export async function markBillingPeriodExported(periodId: string): Promise<void> {
  await updateDoc(billingDocRef(periodId), { status: 'EXPORTED' as BillingPeriodStatus, updatedAt: serverTimestamp() })
}

export async function deleteBillingPeriod(periodId: string): Promise<void> {
  await deleteDoc(billingDocRef(periodId))
}
