#!/usr/bin/env node
/**
 * Deletes the TEST business data from ONE organization (Admin SDK): drivers,
 * vehicles, trips, inspections, payroll periods, billing periods, locations.
 *
 * It does NOT touch: the organization document, any user/login, the audit
 * log (immutable by design), or any other organization.
 *
 * Dry run by default -- prints exactly what would be deleted. Pass --confirm
 * to actually delete. Never point this at a real customer's organization.
 *
 *   cd scripts
 *   node clear-demo-data.mjs --org-id <orgId>              # preview only
 *   node clear-demo-data.mjs --org-id <orgId> --confirm    # delete
 */

import { parseArgs } from 'node:util'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const COLLECTIONS = ['drivers', 'vehicles', 'trips', 'inspections', 'payrollPeriods', 'billingPeriods', 'locations']

const scriptDir = dirname(fileURLToPath(import.meta.url))
const envPath = join(scriptDir, '.env')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    const eq = t.indexOf('=')
    if (!t || t.startsWith('#') || eq === -1) continue
    const key = t.slice(0, eq).trim()
    const value = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (!(key in process.env)) process.env[key] = value
  }
}

const { values: args } = parseArgs({
  options: { 'org-id': { type: 'string' }, confirm: { type: 'boolean', default: false } },
})
if (!args['org-id']) {
  console.error('Usage: node clear-demo-data.mjs --org-id <orgId> [--confirm]')
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

console.log(`Project ${sa.project_id}, organization ${ORG}`)
console.log(args.confirm ? 'MODE: DELETE\n' : 'MODE: dry run (nothing is deleted)\n')

for (const name of COLLECTIONS) {
  const snap = await db.collection(name).where('organizationId', '==', ORG).get()
  console.log(`${name.padEnd(16)} ${snap.size} document(s)${snap.size ? ': ' + snap.docs.map((d) => d.id).join(', ') : ''}`)
  if (args.confirm && snap.size) {
    const batch = db.batch()
    snap.docs.forEach((d) => batch.delete(d.ref))
    await batch.commit()
  }
}
console.log(args.confirm ? '\nDeleted.' : '\nDry run complete. Re-run with --confirm to delete.')
process.exit(0)
