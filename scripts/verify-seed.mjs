#!/usr/bin/env node
/**
 * Read-only check that a seeded organization + first ADMIN user look correct.
 * Reads Firebase Auth + Firestore via the Admin SDK. Writes nothing.
 *
 *   cd scripts
 *   node verify-seed.mjs --org-id <orgId> --uid <uid>
 *   node verify-seed.mjs --org-id <orgId> --admin-email <email>
 *
 * Credentials: GOOGLE_APPLICATION_CREDENTIALS (or scripts/.env / --credentials),
 * same as seed-organization.mjs.
 */

import { parseArgs } from 'node:util'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const scriptDir = dirname(fileURLToPath(import.meta.url))

const ORG_FIELDS = {
  required: ['organizationId', 'name', 'status', 'timezone', 'createdAt', 'updatedAt'],
  optional: ['legalName', 'phone', 'email', 'address'],
}
const USER_FIELDS = {
  required: [
    'uid',
    'organizationId',
    'role',
    'status',
    'firstName',
    'lastName',
    'email',
    'createdAt',
    'updatedAt',
  ],
  optional: ['phone', 'photoURL', 'driverId'],
}

function loadDotEnv(path) {
  if (!existsSync(path)) return
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key && !(key in process.env)) process.env[key] = value
  }
}

const checks = []
function check(ok, label, detail) {
  checks.push({ ok, label, detail })
  const mark = ok ? '  ✔' : '  ✖'
  console.log(`${mark} ${label}${detail ? ` — ${detail}` : ''}`)
}

function isTimestamp(v) {
  return v && typeof v === 'object' && typeof v.toDate === 'function'
}

async function main() {
  loadDotEnv(join(scriptDir, '.env'))

  const { values: args } = parseArgs({
    options: {
      'org-id': { type: 'string' },
      uid: { type: 'string' },
      'admin-email': { type: 'string' },
      credentials: { type: 'string' },
      project: { type: 'string' },
    },
  })

  if (!args['org-id'] || (!args.uid && !args['admin-email'])) {
    console.error(
      'Usage: node verify-seed.mjs --org-id <orgId> (--uid <uid> | --admin-email <email>)',
    )
    process.exit(1)
  }

  const credPath = args.credentials || process.env.GOOGLE_APPLICATION_CREDENTIALS
  let projectId = args.project || process.env.GOOGLE_CLOUD_PROJECT || undefined

  const { default: admin } = await import('firebase-admin')
  if (credPath) {
    const abs = resolve(credPath)
    const sa = JSON.parse(readFileSync(abs, 'utf8'))
    projectId = projectId || sa.project_id
    admin.initializeApp({ credential: admin.credential.cert(sa), projectId })
  } else if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    admin.initializeApp({ projectId })
  } else {
    console.error('No credentials (set GOOGLE_APPLICATION_CREDENTIALS).')
    process.exit(1)
  }

  const auth = admin.auth()
  const db = admin.firestore()
  const orgId = args['org-id']

  console.log(`\nProject: ${projectId}`)
  console.log(`Org    : organizations/${orgId}\n`)

  // --- organization document ---------------------------------------------
  const orgSnap = await db.collection('organizations').doc(orgId).get()
  check(orgSnap.exists, `organizations/${orgId} exists`)
  let org = {}
  if (orgSnap.exists) {
    org = orgSnap.data()
    for (const f of ORG_FIELDS.required) check(f in org, `org.${f} present`, printable(org[f]))
    check(org.organizationId === orgId, 'org.organizationId === doc id', `${org.organizationId}`)
    check(org.status === 'ACTIVE', "org.status === 'ACTIVE'", org.status)
    check(isTimestamp(org.createdAt), 'org.createdAt is a Timestamp')
    check(isTimestamp(org.updatedAt), 'org.updatedAt is a Timestamp')
    check(
      typeof org.timezone === 'string' && org.timezone.length > 0,
      'org.timezone is a non-empty string',
      org.timezone,
    )
    const unknown = Object.keys(org).filter(
      (k) => !ORG_FIELDS.required.includes(k) && !ORG_FIELDS.optional.includes(k),
    )
    check(unknown.length === 0, 'org has no unexpected fields', unknown.join(', ') || 'none')
  }

  // --- resolve the admin uid --------------------------------------------
  let uid = args.uid
  if (!uid && args['admin-email']) {
    try {
      const u = await auth.getUserByEmail(args['admin-email'])
      uid = u.uid
    } catch {
      check(false, `Auth user for <${args['admin-email']}> exists`)
    }
  }

  if (uid) {
    console.log(`\nUser   : users/${uid}\n`)

    // --- Firebase Auth user ---------------------------------------------
    let authUser = null
    try {
      authUser = await auth.getUser(uid)
      check(true, `Firebase Auth user ${uid} exists`, `<${authUser.email}>`)
      check(!authUser.disabled, 'Auth user is not disabled')
    } catch {
      check(false, `Firebase Auth user ${uid} exists`)
    }

    // --- users/{uid} document -----------------------------------------
    const userSnap = await db.collection('users').doc(uid).get()
    check(userSnap.exists, `users/${uid} exists`)
    if (userSnap.exists) {
      const user = userSnap.data()
      for (const f of USER_FIELDS.required) {
        check(f in user, `user.${f} present`, printable(user[f]))
      }
      check(user.uid === uid, 'user.uid === doc id', user.uid)
      check(user.organizationId === orgId, 'user.organizationId === seeded org', user.organizationId)
      check(user.role === 'ADMIN', "user.role === 'ADMIN'", user.role)
      check(user.status === 'ACTIVE', "user.status === 'ACTIVE'", user.status)
      check(isTimestamp(user.createdAt), 'user.createdAt is a Timestamp')
      check(isTimestamp(user.updatedAt), 'user.updatedAt is a Timestamp')
      if (authUser) {
        check(
          (user.email || '').toLowerCase() === (authUser.email || '').toLowerCase(),
          'user.email matches Auth email',
          `${user.email} / ${authUser.email}`,
        )
      }
      const unknown = Object.keys(user).filter(
        (k) => !USER_FIELDS.required.includes(k) && !USER_FIELDS.optional.includes(k),
      )
      check(unknown.length === 0, 'user has no unexpected fields', unknown.join(', ') || 'none')
    }
  }

  const failed = checks.filter((c) => !c.ok)
  console.log(`\n${failed.length === 0 ? '✔ ALL CHECKS PASSED' : `✖ ${failed.length} CHECK(S) FAILED`} (${checks.length} total)\n`)
  process.exit(failed.length === 0 ? 0 : 1)
}

function printable(v) {
  if (isTimestamp(v)) return `Timestamp(${v.toDate().toISOString()})`
  if (v && typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

main().catch((error) => {
  console.error('\n✖ Unexpected error:\n', error)
  process.exit(1)
})
