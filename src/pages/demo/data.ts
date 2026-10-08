import type { TripStatus, UserRole, VehicleStatus } from '../../types'

/** Everything in the public demo is sample data held in memory -- nothing is
 * read from or written to Firebase, and no real person or trip appears. */

export const HOUR = 3600 * 1000

export interface Persona {
  name: string
  title: string
}

export const PERSONAS: Record<UserRole, Persona> = {
  DISPATCHER: { name: 'Dana Reyes', title: 'Dispatcher' },
  MANAGER: { name: 'Priya Shah', title: 'Operations manager' },
  ADMIN: { name: 'Alex Morgan', title: 'Owner / administrator' },
  DRIVER: { name: 'Marcus Bell', title: 'Driver' },
}

export interface DDriver {
  id: string
  name: string
  status: 'ACTIVE' | 'ON_LEAVE'
  hasLogin: boolean
  phone: string
  license: string
}

export interface DVehicle {
  id: string
  label: string
  plate: string
  type: string
  status: VehicleStatus
  wheelchair: boolean
  odometer: number
  where?: string
  speedMph?: number
  ignitionOn?: boolean
  recordedAt?: number
}

export interface DTrip {
  id: string
  pickupAt: number
  from: string
  to: string
  status: TripStatus
  driverId?: string
  vehicleId?: string
  fare: number
  broker: string
  mobility: string
}

export interface DInspection {
  id: string
  vehicleId: string
  driverId: string
  type: 'PRE_TRIP' | 'POST_TRIP'
  status: 'SUBMITTED' | 'APPROVED' | 'FLAGGED'
  at: number
  note?: string
  autoFlagged: boolean
}

export interface DUser {
  id: string
  name: string
  role: UserRole
  active: boolean
}

export interface DAudit {
  id: string
  at: number
  actor: string
  role: UserRole
  action: string
  target: string
  details?: string
}

export interface DBillingLine {
  tripId: string
  route: string
  fare: number
}

export interface DemoData {
  drivers: DDriver[]
  vehicles: DVehicle[]
  trips: DTrip[]
  inspections: DInspection[]
  users: DUser[]
  audit: DAudit[]
  billing: { status: 'DRAFT' | 'FINALIZED' | 'EXPORTED'; lines: DBillingLine[] }
  payroll: { status: 'DRAFT' | 'APPROVED' | 'EXPORTED'; amounts: Record<string, string> }
}

export const PLACES: Record<string, string> = {
  home1: '1420 S 4th St, Springfield',
  home2: '2210 E Ash St, Springfield',
  home3: '905 W Washington St, Springfield',
  home4: '3300 Wabash Ave, Springfield',
  hospital: "St. John's Hospital",
  clinic: 'Springfield Clinic',
  dialysis: 'Springfield Dialysis Center',
  medical: 'Memorial Medical Center',
}

export function initialData(): DemoData {
  const now = Date.now()
  const p = PLACES
  const trip = (
    id: string,
    hrs: number,
    from: string,
    to: string,
    status: TripStatus,
    driverId: string | undefined,
    vehicleId: string | undefined,
    fare: number,
    broker: string,
    mobility: string,
  ): DTrip => ({ id, pickupAt: now + hrs * HOUR, from: p[from], to: p[to], status, driverId, vehicleId, fare, broker, mobility })

  return {
    drivers: [
      { id: 'd1', name: 'Marcus Bell', status: 'ACTIVE', hasLogin: true, phone: '555-0142', license: 'B4410927 (IL)' },
      { id: 'd2', name: 'Sofia Alvarez', status: 'ACTIVE', hasLogin: true, phone: '555-0177', license: 'A7720331 (IL)' },
      { id: 'd3', name: 'Terrence Cole', status: 'ACTIVE', hasLogin: true, phone: '555-0119', license: 'C1093846 (IL)' },
      { id: 'd4', name: 'Helen Park', status: 'ON_LEAVE', hasLogin: false, phone: '555-0164', license: 'P5528810 (IL)' },
    ],
    vehicles: [
      { id: 'v1', label: '2023 Ford Transit Connect', plate: 'NEM-1201', type: 'Wheelchair van', status: 'ASSIGNED', wheelchair: true, odometer: 18420, where: 'Downtown Springfield', speedMph: 24, ignitionOn: true, recordedAt: now - 6 * 60000 },
      { id: 'v2', label: '2024 Chrysler Pacifica', plate: 'NEM-1202', type: 'Wheelchair van', status: 'AVAILABLE', wheelchair: true, odometer: 9210 },
      { id: 'v3', label: '2021 Ford Transit 350', plate: 'NEM-1203', type: 'Ambulette', status: 'ASSIGNED', wheelchair: true, odometer: 44810, where: "Near St. John's Hospital", speedMph: 0, ignitionOn: false, recordedAt: now - 22 * 60000 },
      { id: 'v4', label: '2020 Dodge Grand Caravan', plate: 'NEM-1204', type: 'Sedan', status: 'MAINTENANCE', wheelchair: false, odometer: 61230 },
      { id: 'v5', label: '2023 Chevrolet Express 3500', plate: 'NEM-1205', type: 'Bus', status: 'AVAILABLE', wheelchair: true, odometer: 27400 },
    ],
    trips: [
      trip('t01', -7, 'home1', 'dialysis', 'COMPLETED', 'd1', 'v1', 42.5, 'MedRide', 'Wheelchair'),
      trip('t02', -5, 'home2', 'medical', 'COMPLETED', 'd2', 'v3', 55, 'MedRide', 'Stretcher'),
      trip('t03', -3, 'dialysis', 'home1', 'COMPLETED', 'd1', 'v1', 38, 'CareLink', 'Wheelchair'),
      trip('t04', -1, 'home3', 'clinic', 'DROPPED_OFF', 'd2', 'v3', 47, 'MedRide', 'Ambulatory'),
      trip('t05', 0.5, 'home4', 'hospital', 'ASSIGNED', 'd1', 'v1', 41, 'MedRide', 'Wheelchair'),
      trip('t06', 2, 'clinic', 'home3', 'ASSIGNED', 'd3', 'v2', 36, 'CareLink', 'Ambulatory'),
      trip('t07', 1.5, 'home2', 'dialysis', 'SCHEDULED', undefined, undefined, 44, 'MedRide', 'Wheelchair'),
      trip('t08', 26, 'home1', 'medical', 'SCHEDULED', undefined, undefined, 39, 'CareLink', 'Ambulatory'),
      trip('t09', -2, 'home3', 'hospital', 'CANCELLED', 'd3', 'v2', 40, 'CareLink', 'Ambulatory'),
      trip('t10', -8, 'home2', 'clinic', 'NO_SHOW', 'd1', 'v1', 35, 'CareLink', 'Wheelchair'),
    ],
    inspections: [
      { id: 'i1', vehicleId: 'v1', driverId: 'd1', type: 'PRE_TRIP', status: 'APPROVED', at: now - 8 * HOUR, autoFlagged: false },
      { id: 'i2', vehicleId: 'v3', driverId: 'd2', type: 'POST_TRIP', status: 'SUBMITTED', at: now - 1 * HOUR, note: 'Rear brakes grinding when stopping (moderate)', autoFlagged: true },
      { id: 'i3', vehicleId: 'v2', driverId: 'd3', type: 'PRE_TRIP', status: 'SUBMITTED', at: now - 0.5 * HOUR, autoFlagged: false },
    ],
    users: [
      { id: 'u1', name: 'Alex Morgan', role: 'ADMIN', active: true },
      { id: 'u2', name: 'Priya Shah', role: 'MANAGER', active: true },
      { id: 'u3', name: 'Dana Reyes', role: 'DISPATCHER', active: true },
      { id: 'u4', name: 'Marcus Bell', role: 'DRIVER', active: true },
      { id: 'u5', name: 'Sofia Alvarez', role: 'DRIVER', active: true },
      { id: 'u6', name: 'Terrence Cole', role: 'DRIVER', active: true },
    ],
    audit: [
      { id: 'a2', at: now - 8 * HOUR, actor: 'Dana Reyes', role: 'DISPATCHER', action: 'inspection.approved', target: 'inspections / i1' },
      { id: 'a1', at: now - 26 * HOUR, actor: 'Alex Morgan', role: 'ADMIN', action: 'user.status_changed', target: 'users / u6', details: 'status: ACTIVE' },
    ],
    billing: { status: 'DRAFT', lines: [] },
    payroll: { status: 'DRAFT', amounts: {} },
  }
}

export function money(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

export function sameDay(a: number, b: number): boolean {
  const x = new Date(a)
  const y = new Date(b)
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate()
}

export const NEXT_STATUS: Partial<Record<TripStatus, { to: TripStatus; label: string }>> = {
  SCHEDULED: { to: 'ASSIGNED', label: 'Mark assigned' },
  ASSIGNED: { to: 'EN_ROUTE', label: 'Start trip' },
  EN_ROUTE: { to: 'PICKED_UP', label: 'Mark picked up' },
  PICKED_UP: { to: 'DROPPED_OFF', label: 'Mark dropped off' },
  DROPPED_OFF: { to: 'COMPLETED', label: 'Mark completed' },
}

export const STATUS_TONE: Record<TripStatus, 'neutral' | 'blue' | 'green' | 'amber' | 'red'> = {
  SCHEDULED: 'neutral',
  ASSIGNED: 'blue',
  EN_ROUTE: 'blue',
  PICKED_UP: 'blue',
  DROPPED_OFF: 'blue',
  COMPLETED: 'green',
  CANCELLED: 'red',
  NO_SHOW: 'amber',
}

export const CLOSED: TripStatus[] = ['COMPLETED', 'CANCELLED', 'NO_SHOW']
