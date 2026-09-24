#!/usr/bin/env node
/**
 * Seeds realistic-looking DEMO data into an existing organization (Admin SDK)
 * so a live walkthrough doesn't start on an empty system: a renamed org, a
 * small fleet, a driver roster (three drivers with real logins), a day's
 * worth of trips across every status, and a few inspections.
 *
 * Everything is fake and every document id is prefixed `demo-`, so re-running
 * this overwrites the same documents instead of piling up duplicates (trip
 * times are re-based to "now" on each run). Never point this at a real
 * customer's organization.
 *
 *   cd scripts
 *   node seed-demo-data.mjs --org-id <existing orgId>
 *
 * Deliberately does NOT write audit-log entries -- that trail should only
 * ever contain things that really happened.
 */

import { parseArgs } from 'node:util'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const scriptDir = dirname(fileURLToPath(import.meta.url))

function loadDotEnv(path) {
  if (!existsSync(path)) return
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (key && !(key in process.env)) process.env[key] = value
  }
}

loadDotEnv(join(scriptDir, '.env'))
const { values: args } = parseArgs({ options: { 'org-id': { type: 'string' } } })
if (!args['org-id']) {
  console.error('Usage: node seed-demo-data.mjs --org-id <existing orgId>')
  process.exit(1)
}
const ORG = args['org-id']

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
if (!credPath || !existsSync(resolve(credPath))) {
  console.error('Service-account key not found. Set GOOGLE_APPLICATION_CREDENTIALS in scripts/.env.')
  process.exit(1)
}
const sa = JSON.parse(readFileSync(resolve(credPath), 'utf8'))
const { default: admin } = await import('firebase-admin')
admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id })
const db = admin.firestore()
const auth = admin.auth()
const { Timestamp, GeoPoint, FieldValue } = admin.firestore

const now = Date.now()
const HOUR = 3600 * 1000
const ts = (offsetHours) => Timestamp.fromMillis(now + offsetHours * HOUR)
const stamps = () => ({ createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })

const orgSnap = await db.collection('organizations').doc(ORG).get()
if (!orgSnap.exists) {
  console.error(`organizations/${ORG} does not exist.`)
  process.exit(1)
}

// --- organization + existing test logins get realistic names -----------------
await db.collection('organizations').doc(ORG).update({
  name: 'Riverside Medical Transport (Demo)',
  updatedAt: FieldValue.serverTimestamp(),
})

const renames = {
  Py86U5SSX7WMtuSUOw41xusHueg1: ['Alex', 'Morgan'],
  WFCgFpuRC3YiolfHrpQiCPapYXx1: ['Priya', 'Shah'],
  oRp3G3dVVUWiuFFjzuTLgHIDqRY2: ['Dana', 'Reyes'],
  HnkGKbr1OTMWMZI1X4aQkUWipDy1: ['Marcus', 'Bell'],
}
for (const [uid, [firstName, lastName]] of Object.entries(renames)) {
  const ref = db.collection('users').doc(uid)
  if ((await ref.get()).exists) {
    await ref.update({ firstName, lastName, updatedAt: FieldValue.serverTimestamp() })
    await auth.updateUser(uid, { displayName: `${firstName} ${lastName}` })
  }
}

// --- two more driver logins so Dispatch has real people to assign ------------
async function ensureDriverLogin(email, firstName, lastName) {
  let user
  try {
    user = await auth.getUserByEmail(email)
  } catch {
    user = await auth.createUser({
      email,
      password: 'DemoDriver123!',
      emailVerified: true,
      displayName: `${firstName} ${lastName}`,
    })
  }
  await db.collection('users').doc(user.uid).set({
    uid: user.uid,
    organizationId: ORG,
    role: 'DRIVER',
    status: 'ACTIVE',
    firstName,
    lastName,
    email,
    ...stamps(),
  }, { merge: true })
  return user.uid
}
const MARCUS = 'HnkGKbr1OTMWMZI1X4aQkUWipDy1'
const SOFIA = await ensureDriverLogin('fingerprintacoustic+demo-sofia@gmail.com', 'Sofia', 'Alvarez')
const TERRENCE = await ensureDriverLogin('fingerprintacoustic+demo-terrence@gmail.com', 'Terrence', 'Cole')

// --- driver roster ------------------------------------------------------------
const in2y = ts(24 * 365 * 2)
const drivers = [
  ['demo-driver-marcus', 'Marcus', 'Bell', '555-0142', 'B4410927', MARCUS, 'ACTIVE'],
  ['demo-driver-sofia', 'Sofia', 'Alvarez', '555-0177', 'A7720331', SOFIA, 'ACTIVE'],
  ['demo-driver-terrence', 'Terrence', 'Cole', '555-0119', 'C1093846', TERRENCE, 'ACTIVE'],
  ['demo-driver-helen', 'Helen', 'Park', '555-0164', 'P5528810', null, 'ON_LEAVE'],
]
for (const [id, firstName, lastName, phone, license, userId, status] of drivers) {
  await db.collection('drivers').doc(id).set({
    driverId: id,
    organizationId: ORG,
    ...(userId ? { userId } : {}),
    firstName,
    lastName,
    phone,
    licenseNumber: license,
    licenseState: 'IL',
    licenseExpiry: in2y,
    status,
    ...stamps(),
  })
}

// --- fleet --------------------------------------------------------------------
const springfield = (lat, lng) => new GeoPoint(lat, lng)
const vehicles = [
  ['demo-vehicle-1', 'Ford', 'Transit Connect', 2023, 'NEM-1201', 'WHEELCHAIR_VAN', 'ASSIGNED', true, 18420, -20,
    { position: springfield(39.7990, -89.6440), positionAddress: 'Downtown Springfield, IL', speedMph: 24, ignitionOn: true }],
  ['demo-vehicle-2', 'Chrysler', 'Pacifica', 2024, 'NEM-1202', 'WHEELCHAIR_VAN', 'AVAILABLE', true, 9210, -30, null],
  ['demo-vehicle-3', 'Ford', 'Transit 350', 2021, 'NEM-1203', 'AMBULETTE', 'ASSIGNED', true, 44810, -8,
    { position: springfield(39.8098, -89.6367), positionAddress: 'Near St. John\'s Hospital, Springfield, IL', speedMph: 0, ignitionOn: false }],
  ['demo-vehicle-4', 'Dodge', 'Grand Caravan', 2020, 'NEM-1204', 'SEDAN', 'MAINTENANCE', false, 61230, -200, null],
  ['demo-vehicle-5', 'Chevrolet', 'Express 3500', 2023, 'NEM-1205', 'BUS', 'AVAILABLE', true, 27400, -50, null],
]
for (const [id, make, model, year, plate, type, status, wc, odometer, inspectedHoursAgo, telemetry] of vehicles) {
  await db.collection('vehicles').doc(id).set({
    vehicleId: id,
    organizationId: ORG,
    make,
    model,
    year,
    plate,
    type,
    status,
    wheelchairAccessible: wc,
    odometer,
    lastInspectionAt: ts(inspectedHoursAgo),
    ...(telemetry ? { telemetry: { ...telemetry, recordedAt: ts(-0.1), source: 'MANUAL', updatedBy: 'oRp3G3dVVUWiuFFjzuTLgHIDqRY2' } } : {}),
    ...stamps(),
  })
}

// --- a day of trips -------------------------------------------------------------
const places = {
  home1: ['1420 S 4th St, Springfield, IL', springfield(39.7823, -89.6560)],
  home2: ['2210 E Ash St, Springfield, IL', springfield(39.7902, -89.6231)],
  home3: ['905 W Washington St, Springfield, IL', springfield(39.7972, -89.6600)],
  home4: ['3300 Wabash Ave, Springfield, IL', springfield(39.7629, -89.6795)],
  hospital: ["St. John's Hospital, 800 E Carpenter St, Springfield, IL", springfield(39.8098, -89.6367)],
  clinic: ['Springfield Clinic, 1025 S 6th St, Springfield, IL', springfield(39.7864, -89.6486)],
  dialysis: ['Springfield Dialysis Center, 1100 E Adams St, Springfield, IL', springfield(39.7955, -89.6338)],
  medical: ['Memorial Medical Center, 701 N 1st St, Springfield, IL', springfield(39.8110, -89.6503)],
}
// [id, status, hoursFromNow, from, to, driverUid|null, vehicleId|null, fare|null, broker|null, mobility, miles]
const trips = [
  ['demo-trip-01', 'COMPLETED', -7, 'home1', 'dialysis', MARCUS, 'demo-vehicle-1', 42.5, 'MedRide', ['WHEELCHAIR'], 6.2],
  ['demo-trip-02', 'COMPLETED', -5, 'home2', 'medical', SOFIA, 'demo-vehicle-3', 55, 'MedRide', ['STRETCHER'], 8.9],
  ['demo-trip-03', 'COMPLETED', -3, 'dialysis', 'home1', MARCUS, 'demo-vehicle-1', 38, 'CareLink', ['WHEELCHAIR'], 6.2],
  ['demo-trip-04', 'DROPPED_OFF', -1, 'home3', 'clinic', SOFIA, 'demo-vehicle-3', 47, 'MedRide', ['AMBULATORY'], 5.4],
  ['demo-trip-05', 'EN_ROUTE', -0.25, 'home4', 'hospital', MARCUS, 'demo-vehicle-1', 41, 'MedRide', ['WHEELCHAIR'], 7.7],
  ['demo-trip-06', 'ASSIGNED', 1, 'clinic', 'home3', TERRENCE, 'demo-vehicle-2', 36, 'CareLink', ['AMBULATORY'], 5.4],
  ['demo-trip-07', 'ASSIGNED', 2.5, 'home2', 'dialysis', SOFIA, 'demo-vehicle-3', 52, 'MedRide', ['STRETCHER'], 3.1],
  ['demo-trip-08', 'SCHEDULED', 4, 'home1', 'medical', null, null, 44, 'MedRide', ['WHEELCHAIR'], 6.8],
  ['demo-trip-09', 'SCHEDULED', 26, 'home4', 'clinic', null, null, 39, 'CareLink', ['AMBULATORY'], 6.1],
  ['demo-trip-10', 'CANCELLED', -2, 'home3', 'hospital', TERRENCE, 'demo-vehicle-2', 40, 'CareLink', ['AMBULATORY'], 4.6],
  ['demo-trip-11', 'NO_SHOW', -8, 'home2', 'clinic', MARCUS, 'demo-vehicle-1', 35, 'CareLink', ['WHEELCHAIR'], 4.9],
]
for (const [id, status, hrs, from, to, driverUid, vehicleId, fare, broker, mobility, miles] of trips) {
  await db.collection('trips').doc(id).set({
    tripId: id,
    organizationId: ORG,
    status,
    scheduledPickupAt: ts(hrs),
    scheduledDropoffAt: ts(hrs + 0.6),
    ...(driverUid ? { driverId: driverUid } : {}),
    ...(vehicleId ? { vehicleId } : {}),
    origin: places[from][1],
    destination: places[to][1],
    originAddress: places[from][0],
    destinationAddress: places[to][0],
    mobilityNeeds: mobility,
    distanceMiles: miles,
    estimatedMinutes: Math.round(miles * 3 + 8),
    fare: { amount: fare, currency: 'USD' },
    brokerId: broker,
    createdBy: 'oRp3G3dVVUWiuFFjzuTLgHIDqRY2',
    ...stamps(),
  })
}

// --- inspections ------------------------------------------------------------------
const goodCondition = { exterior: 'EXCELLENT', interior: 'GOOD', tires: 'GOOD', brakes: 'EXCELLENT', fluids: 'GOOD', safetyEquipment: true }
const inspections = [
  ['demo-insp-1', MARCUS, 'demo-vehicle-1', 'PRE_TRIP', 'APPROVED', -8, goodCondition, [], 18410, 'Py86U5SSX7WMtuSUOw41xusHueg1'],
  ['demo-insp-2', SOFIA, 'demo-vehicle-3', 'POST_TRIP', 'FLAGGED', -1,
    { ...goodCondition, brakes: 'POOR', tires: 'FAIR' },
    [{ area: 'Rear brakes', severity: 'MODERATE', description: 'Grinding noise when stopping, needs a mechanic before the next shift.', photoUrls: [] }],
    44805, null],
  ['demo-insp-3', TERRENCE, 'demo-vehicle-2', 'PRE_TRIP', 'SUBMITTED', -0.5, goodCondition, [], 9205, null],
]
for (const [id, driverUid, vehicleId, type, status, hrs, condition, damageNotes, odo, reviewer] of inspections) {
  await db.collection('inspections').doc(id).set({
    inspectionId: id,
    organizationId: ORG,
    driverId: driverUid,
    vehicleId,
    type,
    status,
    occurredAt: ts(hrs),
    odometerMiles: odo,
    condition,
    damageNotes,
    media: [],
    driverConfirmation: true,
    flagged: status === 'FLAGGED',
    ...(reviewer ? { reviewedBy: reviewer, reviewedAt: ts(hrs + 0.3) } : {}),
    ...stamps(),
  })
}

console.log('Demo data written to organizations/' + ORG)
console.log('  org renamed, 4 test logins renamed, 2 extra driver logins (password DemoDriver123!)')
console.log(`  ${drivers.length} drivers, ${vehicles.length} vehicles, ${trips.length} trips, ${inspections.length} inspections`)
process.exit(0)
