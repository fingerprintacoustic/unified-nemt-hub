#!/usr/bin/env node
/**
 * Add a user to an EXISTING organization (Firebase Admin SDK).
 *
 * The Users admin screen (src/pages/users/UsersPage.tsx) can list users,
 * change roles, and activate/deactivate — all of that is a plain Firestore
 * read/update the deployed rules already allow. It cannot CREATE a new user,
 * though: a browser can't create a Firebase Auth account for someone else
 * without signing the admin out and into that new account. This script is
 * the trusted server-side path for that step, run by an operator/admin.
 *
 * Unlike seed-organization.mjs, this does NOT create an organization — the
 * --org-id must already exist. Use seed-organization.mjs for a brand-new
 * customer's first org + admin.
 *
 * Run locally only. Never deployed, never bundled with the app.
 *
 *   cd scripts
 *   npm install
 *   node create-user.mjs \
 *     --org-id <existing orgId> \
 *     --email "sam@acme.example" \
 *     --first-name "Sam" \
 *     --last-name "Rivera" \
 *     --role DISPATCHER
 *
 * Add --dry-run first to preview every write without touching Firebase.
 * See scripts/README.md for the full runbook.
 */

import { parseArgs } from 'node:util'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const scriptDir = dirname(fileURLToPath(import.meta.url))

// --- constants that mirror src/types/index.ts and firestore.rules -----------
const VALID_ROLES = ['ADMIN', 'MANAGER', 'DISPATCHER', 'DRIVER']
const USER_STATUS_ACTIVE = 'ACTIVE' // UserStatus (exact string checked by isActiveUser())

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
Add a user to an EXISTING organization (Firebase Admin SDK).

Required:
  --org-id <string>          Existing organizations/{id} — this script does
                             NOT create organizations (see seed-organization.mjs).
  --email <email>            New user's email (also the Firebase Auth email)
  --first-name <string>
  --last-name <string>
  --role <role>              One of: ${VALID_ROLES.join(', ')}

Optional:
  --phone <string>
  --existing-uid <string>    Use an existing Firebase Auth user instead of
                             looking up / creating one by --email.
  --credentials <path>       Service-account key path
                             (else GOOGLE_APPLICATION_CREDENTIALS).
  --project <id>             Project id (emulator runs; else read from the key).
  --dry-run                  Print planned writes, change nothing.
  --help
`

async function main() {
  loadDotEnv(join(scriptDir, '.env'))

  let parsed
  try {
    parsed = parseArgs({
      options: {
        'org-id': { type: 'string' },
        email: { type: 'string' },
        'first-name': { type: 'string' },
        'last-name': { type: 'string' },
        role: { type: 'string' },
        phone: { type: 'string' },
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
    'org-id': args['org-id'],
    email: args.email,
    'first-name': args['first-name'],
    'last-name': args['last-name'],
    role: args.role,
  }
  const missing = Object.entries(requiredText)
    .filter(([, v]) => !v || !String(v).trim())
    .map(([k]) => `--${k}`)
  if (missing.length) fail(`Missing required argument(s): ${missing.join(', ')}\n${HELP}`)

  const email = args.email.trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fail(`--email does not look like an email address: ${email}`)
  }

  const role = args.role.trim().toUpperCase()
  if (!VALID_ROLES.includes(role)) {
    fail(`--role must be one of: ${VALID_ROLES.join(', ')} (got "${args.role}")`)
  }

  const orgId = args['org-id'].trim()

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

  // --- 0. the organization must already exist ------------------------------
  const orgSnap = await db.collection('organizations').doc(orgId).get()
  if (!orgSnap.exists) {
    fail(
      `organizations/${orgId} does not exist. This script only adds users to an ` +
        `existing organization — use seed-organization.mjs to create a new one.`,
    )
  }
  console.log(`Org     : organizations/${orgId}  "${orgSnap.get('name')}"`)

  // --- 1. resolve the Firebase Auth user ------------------------------------
  const authResult = await resolveAuthUser(auth, args, email, dryRun)
  const uid = authResult.uid
  console.log(
    `Auth user : ${uid}  (${authResult.action})` +
      (authResult.email ? `  <${authResult.email}>` : ''),
  )

  // --- 2. resolve the users/{uid} doc ---------------------------------------
  const userDoc = await resolveUserDoc(db, uid, orgId, role, dryRun)
  console.log(`User doc  : users/${uid}  (${userDoc.action})\n`)

  // --- assemble payload ------------------------------------------------------
  const userPayload = {
    uid,
    organizationId: orgId,
    role,
    status: USER_STATUS_ACTIVE,
    firstName: args['first-name'].trim(),
    lastName: args['last-name'].trim(),
    email,
    createdAt: serverTimestamp,
    updatedAt: serverTimestamp,
    ...(args.phone ? { phone: args.phone.trim() } : {}),
  }

  const willCreateUser = userDoc.action === 'create'

  console.log('Planned writes:')
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

  if (!willCreateUser) {
    console.log('\nNothing to do — user already present with this role, org, and ACTIVE status.\n')
    process.exit(0)
  }

  await db.collection('users').doc(uid).set(userPayload)
  console.log('✔ Firestore document written.')

  if (authResult.action === 'created Auth user') {
    try {
      const link = await auth.generatePasswordResetLink(email)
      console.log(
        `\nSend this password-setup link to ${email}:\n${link}\n` +
          '(No email is sent automatically — deliver it yourself.)',
      )
    } catch (error) {
      console.log(
        `\nAuth user created, but could not generate a password-reset link: ${error.message}\n` +
          `Have the user use "Forgot password" at the sign-in page, or send a reset from the ` +
          `Firebase console.`,
      )
    }
  }

  console.log('\n✔ Done.\n')
  process.exit(0)
}

// ---------------------------------------------------------------------------

async function resolveAuthUser(auth, args, email, dryRun) {
  if (args['existing-uid']) {
    try {
      const user = await auth.getUser(args['existing-uid'])
      if (user.email && user.email.toLowerCase() !== email.toLowerCase()) {
        fail(
          `--existing-uid ${user.uid} has email <${user.email}>, which does not match ` +
            `--email <${email}>.`,
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
    const user = await auth.getUserByEmail(email)
    return { uid: user.uid, email: user.email, action: 'existing (by email)' }
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error
  }

  if (dryRun) {
    return { uid: '(new)', email, action: 'would create Auth user' }
  }

  const displayName = `${args['first-name'].trim()} ${args['last-name'].trim()}`.trim()
  const user = await auth.createUser({ email, displayName, emailVerified: false })
  return { uid: user.uid, email: user.email, action: 'created Auth user' }
}

async function resolveUserDoc(db, uid, orgId, role, dryRun) {
  if (dryRun && uid === '(new)') return { action: 'create' }

  const ref = db.collection('users').doc(uid)
  const snap = await ref.get()
  if (!snap.exists) return { action: 'create' }

  const data = snap.data()
  if (
    data.organizationId === orgId &&
    data.role === role &&
    data.status === USER_STATUS_ACTIVE
  ) {
    return { action: 'noop (already present)' }
  }
  fail(
    `users/${uid} already exists but does not match this request ` +
      `(organizationId=${data.organizationId}, role=${data.role}, status=${data.status}).\n` +
      `  Refusing to overwrite an existing user document — use the Users admin screen in the ` +
      `app to change an existing user's role or status instead.`,
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
