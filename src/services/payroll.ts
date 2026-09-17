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
import type { PayrollEntry, PayrollPeriodRecord, PayrollPeriodStatus, Timestamp } from '../types'

const PAYROLL_COLLECTION = 'payrollPeriods'

function payrollRef() {
  return collection(getFirestore(), PAYROLL_COLLECTION)
}

export function payrollDocRef(periodId: string) {
  return doc(payrollRef(), periodId)
}

/** Live list of every payroll period in an organization, most recent first. */
export function observeOrgPayrollPeriods(
  organizationId: string,
  onData: (records: PayrollPeriodRecord[]) => void,
  onError?: (error: unknown) => void,
): () => void {
  const q = query(payrollRef(), where('organizationId', '==', organizationId))
  return onSnapshot(q, {
    next: (snapshot: QuerySnapshot) => {
      const records = snapshot.docs.map((d) => d.data() as PayrollPeriodRecord)
      records.sort((a, b) => b.startDate.toMillis() - a.startDate.toMillis())
      onData(records)
    },
    error: onError,
  })
}

export async function createPayrollPeriod(input: {
  organizationId: string
  startDate: Timestamp
  endDate: Timestamp
  createdBy: string
}): Promise<string> {
  const ref = doc(payrollRef())
  await setDoc(ref, {
    periodId: ref.id,
    organizationId: input.organizationId,
    startDate: input.startDate,
    endDate: input.endDate,
    status: 'DRAFT' as PayrollPeriodStatus,
    entries: [],
    createdBy: input.createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

/** Replaces the whole entries array -- the edit form always saves the full,
 * current set of rows rather than patching individual entries. */
export async function savePayrollEntries(periodId: string, entries: PayrollEntry[]): Promise<void> {
  await updateDoc(payrollDocRef(periodId), { entries, updatedAt: serverTimestamp() })
}

export async function approvePayrollPeriod(periodId: string, approverUid: string): Promise<void> {
  await updateDoc(payrollDocRef(periodId), {
    status: 'APPROVED' as PayrollPeriodStatus,
    approvedBy: approverUid,
    approvedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

/** Sends an already-approved period back to DRAFT for corrections. */
export async function reopenPayrollPeriod(periodId: string): Promise<void> {
  await updateDoc(payrollDocRef(periodId), { status: 'DRAFT' as PayrollPeriodStatus, updatedAt: serverTimestamp() })
}

/** Marks a period exported. The CSV itself is generated client-side from
 * data already on screen -- this just records that it happened. */
export async function markPayrollPeriodExported(periodId: string): Promise<void> {
  await updateDoc(payrollDocRef(periodId), { status: 'EXPORTED' as PayrollPeriodStatus, updatedAt: serverTimestamp() })
}

export async function deletePayrollPeriod(periodId: string): Promise<void> {
  await deleteDoc(payrollDocRef(periodId))
}
