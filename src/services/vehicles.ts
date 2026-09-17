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
import type { Timestamp, VehicleRecord, VehicleStatus, VehicleTelemetry } from '../types'

const VEHICLES_COLLECTION = 'vehicles'

function vehiclesRef() {
  return collection(getFirestore(), VEHICLES_COLLECTION)
}

export function vehicleDocRef(vehicleId: string) {
  return doc(vehiclesRef(), vehicleId)
}

/**
 * Live list of every vehicle in an organization. Any active org member may
 * read (firestore.rules), but only this page's staff-only route exposes
 * create/update/delete. Sorted client-side, like observeOrgUsers, so this
 * doesn't need a new composite Firestore index.
 */
export function observeOrgVehicles(
  organizationId: string,
  onData: (records: VehicleRecord[]) => void,
  onError?: (error: unknown) => void,
): () => void {
  const q = query(vehiclesRef(), where('organizationId', '==', organizationId))
  return onSnapshot(q, {
    next: (snapshot: QuerySnapshot) => {
      const records = snapshot.docs.map((d) => d.data() as VehicleRecord)
      records.sort((a, b) => `${a.make} ${a.model}`.localeCompare(`${b.make} ${b.model}`))
      onData(records)
    },
    error: onError,
  })
}

// lastInspectionAt and telemetry are written by their own dedicated setters,
// never from this form.
export type NewVehicleInput = Omit<
  VehicleRecord,
  'vehicleId' | 'createdAt' | 'updatedAt' | 'lastInspectionAt' | 'telemetry'
>

export async function createVehicle(input: NewVehicleInput): Promise<string> {
  const ref = doc(vehiclesRef())
  await setDoc(ref, {
    ...input,
    vehicleId: ref.id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export type VehiclePatch = Partial<
  Omit<VehicleRecord, 'vehicleId' | 'organizationId' | 'createdAt' | 'updatedAt' | 'lastInspectionAt' | 'telemetry'>
>

export async function updateVehicle(vehicleId: string, patch: VehiclePatch): Promise<void> {
  await updateDoc(vehicleDocRef(vehicleId), { ...patch, updatedAt: serverTimestamp() })
}

export async function setVehicleStatus(vehicleId: string, status: VehicleStatus): Promise<void> {
  await updateDoc(vehicleDocRef(vehicleId), { status, updatedAt: serverTimestamp() })
}

/**
 * Records when a vehicle was last inspected. Deliberately its own function
 * rather than part of VehiclePatch -- only the Inspections review flow
 * (staff approving an inspection) should set this, not the vehicle edit
 * form, and firestore.rules only allows staff to write vehicles at all
 * (a driver submitting an inspection can't bump this themself).
 */
export async function setVehicleLastInspection(vehicleId: string, occurredAt: Timestamp): Promise<void> {
  await updateDoc(vehicleDocRef(vehicleId), { lastInspectionAt: occurredAt, updatedAt: serverTimestamp() })
}

/**
 * Records a vehicle's last-known position/speed/ignition (Phase 8
 * telematics scaffolding). Its own function for the same reason as
 * setVehicleLastInspection -- a dedicated write path keeps `source` and
 * `recordedAt` honest, rather than letting the general edit form set them.
 */
export async function setVehicleTelemetry(vehicleId: string, telemetry: VehicleTelemetry): Promise<void> {
  await updateDoc(vehicleDocRef(vehicleId), { telemetry, updatedAt: serverTimestamp() })
}

export async function deleteVehicle(vehicleId: string): Promise<void> {
  await deleteDoc(vehicleDocRef(vehicleId))
}
