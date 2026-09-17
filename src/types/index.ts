/**
 * Shared domain types for the Unified NEMT Operations Hub.
 * These map 1:1 to Cloud Firestore documents designed for future
 * server-side (rules + Cloud Functions) enforcement.
 */

import type { GeoPoint, Timestamp } from 'firebase/firestore'

export type UserRole = 'ADMIN' | 'MANAGER' | 'DISPATCHER' | 'DRIVER'

export type UserStatus = 'ACTIVE' | 'DISABLED' | 'PENDING'

export interface UserRecord {
  /** Firebase Auth UID. */
  uid: string
  organizationId: string
  role: UserRole
  status: UserStatus
  firstName: string
  lastName: string
  email: string
  phone?: string
  photoURL?: string
  driverId?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type DriverStatus = 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE'

export interface DriverRecord {
  driverId: string
  organizationId: string
  userId?: string
  firstName: string
  lastName: string
  email?: string
  phone: string
  licenseNumber: string
  licenseState: string
  licenseExpiry: Timestamp
  certificationExpiry?: Timestamp
  status: DriverStatus
  emergencyContact?: EmergencyContact
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface EmergencyContact {
  name: string
  relationship: string
  phone: string
}

export type VehicleStatus =
  | 'AVAILABLE'
  | 'ASSIGNED'
  | 'MAINTENANCE'
  | 'OUT_OF_SERVICE'

export type VehicleType = 'SEDAN' | 'WHEELCHAIR_VAN' | 'AMBULETTE' | 'BUS' | 'OTHER'

export interface VehicleRecord {
  vehicleId: string
  organizationId: string
  make: string
  model: string
  year: number
  plate: string
  vin?: string
  type: VehicleType
  status: VehicleStatus
  wheelchairAccessible: boolean
  odometer: number
  lastInspectionAt?: Timestamp
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type TripStatus =
  | 'SCHEDULED'
  | 'ASSIGNED'
  | 'EN_ROUTE'
  | 'PICKED_UP'
  | 'DROPPED_OFF'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'

export type MobilityNeeds = 'WHEELCHAIR' | 'STRETCHER' | 'AMBULATORY' | 'OTHER'

export interface Money {
  amount: number
  currency: string
}

export interface TripRecord {
  tripId: string
  organizationId: string
  status: TripStatus
  scheduledPickupAt: Timestamp
  scheduledDropoffAt?: Timestamp
  // No PII in TripRecord — passenger details live in separate subcollections (future).
  driverId?: string
  vehicleId?: string
  origin: GeoPoint
  destination: GeoPoint
  originAddress: string
  destinationAddress: string
  mobilityNeeds?: MobilityNeeds[]
  distanceMiles?: number
  estimatedMinutes?: number
  fare?: Money
  brokerId?: string
  notes?: string
  createdAt: Timestamp
  updatedAt: Timestamp
  createdBy: string
}

export type InspectionType = 'PRE_TRIP' | 'POST_TRIP'

export type InspectionStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'FLAGGED'

export interface VehicleCondition {
  exterior: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR'
  interior: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR'
  tires: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR'
  brakes: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR'
  fluids: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR'
  safetyEquipment: boolean
}

export interface DamageNote {
  area: string
  severity: 'MINOR' | 'MODERATE' | 'SEVERE'
  description: string
  photoUrls: string[]
}

export interface InspectionMedia {
  type: 'PHOTO' | 'VIDEO'
  url: string
  storagePath: string
  capturedAt: Timestamp
}

export interface InspectionRecord {
  inspectionId: string
  organizationId: string
  driverId: string
  vehicleId: string
  tripId?: string
  type: InspectionType
  status: InspectionStatus
  occurredAt: Timestamp
  createdAt: Timestamp
  updatedAt: Timestamp
  gpsLocation?: GeoPoint
  odometerMiles?: number
  condition?: VehicleCondition
  damageNotes: DamageNote[]
  media: InspectionMedia[]
  driverConfirmation: boolean
  driverSignatureUrl?: string
  flagged: boolean
  reviewedBy?: string
  reviewedAt?: Timestamp
}

export type OrganizationStatus = 'ACTIVE' | 'SUSPENDED'

export interface OrganizationRecord {
  organizationId: string
  name: string
  legalName?: string
  status: OrganizationStatus
  phone?: string
  email?: string
  address?: Address
  timezone: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface Address {
  line1: string
  line2?: string
  city: string
  state: string
  zip: string
  country: string
}

export interface LocationRecord {
  locationId: string
  organizationId: string
  name: string
  type: 'FACILITY' | 'HOME' | 'HOSPITAL' | 'CLINIC' | 'TRANSFER_POINT' | 'OTHER'
  address: Address
  geoPoint?: GeoPoint
  phone?: string
  notes?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type PayrollPeriodStatus = 'DRAFT' | 'APPROVED' | 'EXPORTED'

export interface PayrollEntry {
  /** Firebase Auth uid of the driver -- same convention as TripRecord.driverId
   * and InspectionRecord.driverId, so it links directly to users/{uid}. */
  driverId: string
  amount: Money
  notes?: string
}

/**
 * A payroll period is deliberately manual-entry, not auto-calculated: how a
 * driver's pay is derived from trips (flat/hourly/percentage/etc.) is a real
 * compensation decision this app doesn't make. entries[].amount is entered
 * by staff; tripsCompleted (see services/payroll.ts) is shown alongside as
 * reference context only, never used to compute amount.
 */
export interface PayrollPeriodRecord {
  periodId: string
  organizationId: string
  startDate: Timestamp
  endDate: Timestamp
  status: PayrollPeriodStatus
  entries: PayrollEntry[]
  createdBy: string
  createdAt: Timestamp
  updatedAt: Timestamp
  approvedBy?: string
  approvedAt?: Timestamp
}

export interface AuditLogRecord {
  logId: string
  organizationId: string
  action: string
  actorId: string
  actorRole: UserRole
  targetCollection: string
  targetId?: string
  details?: Record<string, unknown>
  createdAt: Timestamp
}

export type { GeoPoint, Timestamp }