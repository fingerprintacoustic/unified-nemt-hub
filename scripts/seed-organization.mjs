#!/usr/bin/env node
/**
 * One-time bootstrap: seed a new customer organization plus its first ADMIN user.
 *
 * This is the trusted server-side path referenced by firestore.rules and
 * src/services/users.ts. It uses the Firebase Admin SDK, which bypasses
 * Firestore security rules, so it can create the first `organizations/{orgId}`
 * and `users/{uid}` documents that no client is permitted to create.
 *
 * Run locally only. Never deployed, never bundled with the app.
 *
 *   cd scripts
 *   npm install
 *   node seed-organization.mjs \
 *     --org-name "Acme Medical Transport" \
 *     --org-timezone "America/New_York" \
 *     --admin-email "jane@acme.example" \
 *     --admin-first-name "Jane" \
 *     --admin-last-name "Doe"
 *
 * Add --dry-run first to preview every write without touching Firebase.
 * See scripts/README.md for the full runbook.
 */

import { parseArgs } from 'node:util'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const scriptDir = dirname(fileURLToPath(import.meta.url))

// --- constants that mirror src/types/index.ts and firestore.rules -------------
const ORG_STATUS_ACTIVE = 'ACTIVE' // OrganizationStatus
const USER_ROLE_ADMIN = 'ADMIN' // UserRole
const USER_STATUS_ACTIVE = 'ACTIVE' // UserStatus (exact string checked by isActiveUser())
const REQUIRED_ADDRESS_KEYS = ['line1', 'city', 'state', 'zip', 'country']

// --- tiny .env loader (scripts/.env) — no dependency -------------------------
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

function fail(message) {
  console.error(`\n✖ ${message}\n`)
  process.exit(1)
}

const HELP = `
Seed one new organization + its first ADMIN user (Firebase Admin SDK).

Required:
  --org-name <string>          Organization display name
  --org-timezone <IANA tz>     e.g. "America/New_York"
  --admin-email <email>        First admin's email (also the Firebase Auth email)
  --admin-first-name <string>
  --admin-last-name <string>

Optional:
  --org-id <string>            Target/keep a specific organizations/{id}.
                               Omitted: a new auto-id is generated (aborts if an
                               org with the same --org-name already exists).
  --org-legal-name <string>
  --org-phone <string>
  --org-email <email>
  --org-address-line1 <string> Address is written only if line1/city/state/zip/
  --org-address-line2 <string> country are all provided (line2 optional).
  --org-address-city <string>
  --org-address-state <string>
  --org-address-zip <string>
  --org-address-country <string>
  --admin-phone <string>
  --existing-uid <string>      Use an existing Firebase Auth user instead of
                               looking up / creating one by --admin-email.
  --credentials <path>         Service-account key path
                               (else GOOGLE_APPLICATION_CREDENTIALS).
  --project <id>               Project id (emulator runs; else read from the key).
  --dry-run                    Print planned writes, change nothing.
  --help
`

async function main() {
  loadDotEnv(join(scriptDir, '.env'))

  let parsed
  try {
    parsed = parseArgs({
      options: {
        'org-name': { type: 'string' },
        'org-timezone': { type: 'string' },
        'org-id': { type: 'string' },
        'org-legal-name': { type: 'string' },
        'org-phone': { type: 'string' },
        'org-email': { type: 'string' },
        'org-address-line1': { type: 'string' },
        'org-address-line2': { type: 'string' },
        'org-address-city': { type: 'string' },
        'org-address-state': { type: 'string' },
        'org-address-zip': { type: 'string' },
        'org-address-country': { type: 'string' },
        'admin-email': { type: 'string' },
        'admin-first-name': { type: 'string' },
        'admin-last-name': { type: 'string' },
        'admin-phone': { type: 'string' },
        'existing-uid': { type: 'string' },
        credentials: { type: 'string' },
        project: { type: 'string' },
        'dry-run': { type: 'boolean', default: false },
        help: { type: 'boolean', default: false },
      },
    })
  } catch (error) {
    fail(`${error.message}\n${HELP}`)
  }

  const args = parsed.values
  if (args.help) {
    console.log(HELP)
    process.exit(0)
  }

  // --- validate inputs -------------------------------------------------------
  const requiredText = {
    'org-name': args['org-name'],
    'org-timezone': args['org-timezone'],
    'admin-email': args['admin-email'],
    'admin-first-name': args['admin-first-name'],
    'admin-last-name': args['admin-last-name'],
  }
  const missing = Object.entries(requiredText)
    .filter(([, v]) => !v || !String(v).trim())
    .map(([k]) => `--${k}`)
  if (missing.length) fail(`Missing required argument(s): ${missing.join(', ')}\n${HELP}`)

  const adminEmail = args['admin-email'].trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
    fail(`--admin-email does not look like an email address: ${adminEmail}`)
  }

  const timezone = args['org-timezone'].trim()
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone })
  } catch {
    fail(`--org-timezone is not a valid IANA time zone: ${timezone}`)
  }

  const address = buildAddress(args)

  // Loaded lazily so --help and input validation work before `npm install`.
  let admin
  try {
    ;({ default: admin } = await import('firebase-admin'))
  } catch {
    fail("Cannot find 'firebase-admin'. Run `npm install` inside scripts/ first.")
  }

  // --- initialize Admin SDK ------------------------------------------------
  const usingEmulator = Boolean(
    process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST,
  )
  const credPath = args.credentials || process.env.GOOGLE_APPLICATION_CREDENTIALS
  let projectId =
    args.project || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || undefined

  if (credPath) {
    const absCredPath = resolve(credPath)
    if (!existsSync(absCredPath)) fail(`Service-account key not found: ${absCredPath}`)
    let serviceAccount
    try {
      serviceAccount = JSON.parse(readFileSync(absCredPath, 'utf8'))
    } catch (error) {
      fail(`Could not parse service-account key as JSON: ${error.message}`)
    }
    projectId = projectId || serviceAccount.project_id
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId })
  } else if (usingEmulator) {
    if (!projectId) {
      fail('Emulator run needs a project id: pass --project or set GOOGLE_CLOUD_PROJECT.')
    }
    admin.initializeApp({ projectId })
  } else {
    fail(
      'No credentials. Set GOOGLE_APPLICATION_CREDENTIALS (or --credentials) to your ' +
        'service-account key, or point FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST ' +
        'at local emulators.',
    )
  }

  const auth = admin.auth()
  const db = admin.firestore()
  const serverTimestamp = admin.firestore.FieldValue.serverTimestamp()
  const dryRun = args['dry-run']

  console.log(`\nProject : ${projectId ?? '(from ADC)'}${usingEmulator ? '  [emulator]' : ''}`)
  console.log(`Mode    : ${dryRun ? 'DRY RUN (no writes)' : 'LIVE'}\n`)

  // --- 1. resolve the Firebase Auth user ----------------------------------
  const authResult = await resolveAuthUser(auth, args, adminEmail, dryRun)
  const uid = authResult.uid
  console.log(
    `Auth user : ${uid}  (${authResult.action})` +
      (authResult.email ? `  <${authResult.email}>` : ''),
  )

  // --- 2. resolve the organization doc ----------------------------------
  const org = await resolveOrg(db, args)
  console.log(
    `Org doc   : organizations/${org.id}  (${org.existed ? 'exists — reuse' : 'will create'})` +
      (org.existingName ? `  "${org.existingName}"` : ''),
  )

  // --- 3. resolve the users/{uid} doc ------------------------------------
  const userDoc = await resolveUserDoc(db, uid, org.id, dryRun)
  console.log(`User doc  : users/${uid}  (${userDoc.action})\n`)

  // --- assemble payloads --------------------------------------------------
  const orgPayload = {
    organizationId: org.id,
    name: args['org-name'].trim(),
    status: ORG_STATUS_ACTIVE,
    timezone,
    createdAt: serverTimestamp,
    updatedAt: serverTimestamp,
    ...(args['org-legal-name'] ? { legalName: args['org-legal-name'].trim() } : {}),
    ...(args['org-phone'] ? { phone: args['org-phone'].trim() } : {}),
    ...(args['org-email'] ? { email: args['org-email'].trim() } : {}),
    ...(address ? { address } : {}),
  }
  const userPayload = {
    uid,
    organizationId: org.id,
    role: USER_ROLE_ADMIN,
    status: USER_STATUS_ACTIVE,
    firstName: args['admin-first-name'].trim(),
    lastName: args['admin-last-name'].trim(),
    email: adminEmail,
    createdAt: serverTimestamp,
    updatedAt: serverTimestamp,
    ...(args['admin-phone'] ? { phone: args['admin-phone'].trim() } : {}),
  }

  const willCreateOrg = !org.existed
  const willCreateUser = userDoc.action === 'create'

  console.log('Planned writes:')
  console.log(
    willCreateOrg
      ? `  set organizations/${org.id} = ${previewJson(orgPayload)}`
      : `  organizations/${org.id} unchanged`,
  )
  console.log(
    willCreateUser
      ? `  set users/${uid} = ${previewJson(userPayload)}`
      : `  users/${uid} unchanged`,
  )
  if (authResult.action === 'would create Auth user') {
    console.log('  create Firebase Auth user + generate password-reset link')
  }

  if (dryRun) {
    console.log('\nDry run complete — nothing was written.\n')
    process.exit(0)
  }

  if (!willCreateOrg && !willCreateUser) {
    console.log('\nNothing to do — organization and first admin already present and consistent.\n')
    process.exit(0)
  }

  // --- commit both docs atomically -------------------------------------
  const batch = db.batch()
  if (willCreateOrg) batch.set(db.collection('organizations').doc(org.id), orgPayload)
  if (willCreateUser) batch.set(db.collection('users').doc(uid), userPayload)
  await batch.commit()
  console.log('✔ Firestore documents written.')

  // --- password setup link for a freshly created Auth user -------------
  if (authResult.action === 'created Auth user') {
    try {
      const link = await auth.generatePasswordResetLink(adminEmail)
      console.log(
        `\nSend this password-setup link to ${adminEmail}:\n${link}\n` +
          '(No email is sent automatically — deliver it yourself.)',
      )
    } catch (error) {
      console.log(
        `\nAuth user created, but could not generate a password-reset link: ${error.message}\n` +
          `Have the admin use "Forgot password" at the sign-in page, or send a reset from the ` +
          `Firebase console.`,
      )
    }
  }

  console.log('\n✔ Done.\n')
  process.exit(0)
}

// ---------------------------------------------------------------------------

function buildAddress(args) {
  const raw = {
    line1: args['org-address-line1'],
    line2: args['org-address-line2'],
    city: args['org-address-city'],
    state: args['org-address-state'],
    zip: args['org-address-zip'],
    country: args['org-address-country'],
  }
  const provided = Object.entries(raw).filter(([, v]) => v != null && String(v).trim() !== '')
  if (provided.length === 0) return undefined
  const missing = REQUIRED_ADDRESS_KEYS.filter(
    (k) => !raw[k] || String(raw[k]).trim() === '',
  )
  if (missing.length) {
    fail(`Incomplete --org-address-*: also provide ${missing.map((k) => `--org-address-${k}`).join(', ')}`)
  }
  return {
    line1: raw.line1.trim(),
    ...(raw.line2 && raw.line2.trim() ? { line2: raw.line2.trim() } : {}),
    city: raw.city.trim(),
    state: raw.state.trim(),
    zip: raw.zip.trim(),
    country: raw.country.trim(),
  }
}

async function resolveAuthUser(auth, args, adminEmail, dryRun) {
  if (args['existing-uid']) {
    try {
      const user = await auth.getUser(args['existing-uid'])
      if (user.email && user.email.toLowerCase() !== adminEmail.toLowerCase()) {
        fail(
          `--existing-uid ${user.uid} has email <${user.email}>, which does not match ` +
            `--admin-email <${adminEmail}>.`,
        )
      }
      return { uid: user.uid, email: user.email, action: 'existing (by uid)' }
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        fail(`--existing-uid ${args['existing-uid']} not found in Firebase Auth.`)
      }
      throw error
    }
  }

  try {
    const user = await auth.getUserByEmail(adminEmail)
    return { uid: user.uid, email: user.email, action: 'existing (by email)' }
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error
  }

  if (dryRun) {
    return { uid: '(new)', email: adminEmail, action: 'would create Auth user' }
  }

  const displayName = `${args['admin-first-name'].trim()} ${args['admin-last-name'].trim()}`.trim()
  const user = await auth.createUser({ email: adminEmail, displayName, emailVerified: false })
  return { uid: user.uid, email: user.email, action: 'created Auth user' }
}

async function resolveOrg(db, args) {
  const organizations = db.collection('organizations')

  if (args['org-id']) {
    const ref = organizations.doc(args['org-id'])
    const snap = await ref.get()
    return {
      id: ref.id,
      existed: snap.exists,
      existingName: snap.exists ? snap.get('name') : undefined,
    }
  }

  const dupe = await organizations.where('name', '==', args['org-name'].trim()).limit(1).get()
  if (!dupe.empty) {
    fail(
      `An organization named "${args['org-name'].trim()}" already exists (id ${dupe.docs[0].id}).\n` +
        `  Re-run with --org-id ${dupe.docs[0].id} to target it, or choose a different --org-name.`,
    )
  }
  return { id: organizations.doc().id, existed: false, existingName: undefined }
}

async function resolveUserDoc(db, uid, orgId, dryRun) {
  if (dryRun && uid === '(new)') return { action: 'create' }

  const ref = db.collection('users').doc(uid)
  const snap = await ref.get()
  if (!snap.exists) return { action: 'create' }

  const data = snap.data()
  if (
    data.organizationId === orgId &&
    data.role === USER_ROLE_ADMIN &&
    data.status === USER_STATUS_ACTIVE
  ) {
    return { action: 'noop (already seeded)' }
  }
  fail(
    `users/${uid} already exists but does not match this seed ` +
      `(organizationId=${data.organizationId}, role=${data.role}, status=${data.status}).\n` +
      `  Refusing to modify an existing user document.`,
  )
}

function previewJson(payload) {
  return JSON.stringify(payload, (key, value) =>
    key === 'createdAt' || key === 'updatedAt' ? '<serverTimestamp>' : value,
  )
}

main().catch((error) => {
  console.error('\n✖ Unexpected error:\n', error)
  process.exit(1)
})
