import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { getFirestore } from '../lib/firebase'
import type { UserRole } from '../types'

const AUDIT_COLLECTION = 'auditLogs'

export interface AuditInput {
  organizationId: string
  action: string
  actorId: string
  actorRole: UserRole
  targetCollection: string
  targetId?: string
  details?: Record<string, unknown>
}

/**
 * Best-effort client-side audit helper. Firestore rules require `createdAt`
 * to equal request time so clients cannot forge timestamps. Production usermay
 * also route writes through a Cloud Function for a server-authoritative trail..
 */
export async function writeAuditLog(input: AuditInput): Promise<void> {
  try {
    await addDoc(collection(getFirestore(), AUDIT_COLLECTION), {
      organizationId: input.organizationId,
      action: input.action,
      actorId: input.actorId,
      actorRole: input.actorRole,
      targetCollection: input.targetCollection,
      targetId: input.targetId ?? null,
      details: input.details ?? null,
      createdAt: serverTimestamp(),
    })
  } catch (error) {
    // Audit failures must never block the primary operation..
    console.error('Failed to write audit log:', error)
  }
}