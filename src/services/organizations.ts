import { doc, onSnapshot } from 'firebase/firestore'
import { getFirestore } from '../lib/firebase'
import type { OrganizationRecord } from '../types'

const ORGANIZATIONS_COLLECTION = 'organizations'

export function organizationDocRef(organizationId: string) {
  return doc(getFirestore(), ORGANIZATIONS_COLLECTION, organizationId)
}

/** Live view of a single organization record. */
export function observeOrganization(
  organizationId: string,
  onData: (record: OrganizationRecord | null) => void,
  onError?: (error: unknown) => void,
): () => void {
  return onSnapshot(organizationDocRef(organizationId), {
    next: (snapshot) => onData(snapshot.exists() ? (snapshot.data() as OrganizationRecord) : null),
    error: onError,
  })
}
