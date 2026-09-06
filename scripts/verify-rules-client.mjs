#!/usr/bin/env node
/**
 * Authenticated-CLIENT check of the deployed Firestore rules.
 *
 * The Admin SDK ignores security rules, so seed-organization.mjs / verify-seed.mjs
 * cannot tell us whether the rules actually work for a signed-in app user. This
 * script mints a custom token for the seeded admin (Admin SDK, no password
 * needed), exchanges it for an ID token, and then calls the Firestore REST API
 * exactly as an authenticated browser client would — so every read/write below
 * is evaluated by the real rules, including isActiveUser() / callerOrgId() /
 * sameOrg() / isStaff(), which depend on the get()/exists() helpers that were
 * just moved into scope.
 *
 *   cd scripts
 *   node verify-rules-client.mjs --uid <uid> --org-id <orgId>
 *
 * Reads VITE_FIREBASE_API_KEY + VITE_FIREBASE_PROJECT_ID from ../.env.
 * Credentials: GOOGLE_APPLICATION_CREDENTIALS (or scripts/.env).
 * Writes: one self-update it makes and then reverts; nothing else is mutated.
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
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key && !(key in process.env)) process.env[key] = value
  }
}

const results = []
function record(ok, label, detail) {
  results.push({ ok, label, detail })
  console.log(`  ${ok ? '✔' : '✖'} ${label}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
  loadDotEnv(join(scriptDir, '.env'))
  loadDotEnv(join(scriptDir, '..', '.env'))

  const { values: args } = parseArgs({
    options: {
      uid: { type: 'string' },
      'org-id': { type: 'string' },
      credentials: { type: 'string' },
    },
  })
  if (!args.uid || !args['org-id']) {
    console.error('Usage: node verify-rules-client.mjs --uid <uid> --org-id <orgId>')
    process.exit(1)
  }

  const apiKey = process.env.VITE_FIREBASE_API_KEY
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID
  if (!apiKey || !projectId) {
    console.error('VITE_FIREBASE_API_KEY / VITE_FIREBASE_PROJECT_ID not found in ../.env')
    process.exit(1)
  }

  const credPath = args.credentials || process.env.GOOGLE_APPLICATION_CREDENTIALS
  const sa = JSON.parse(readFileSync(resolve(credPath), 'utf8'))
  const { default: admin } = await import('firebase-admin')
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId })

  const uid = args.uid
  const orgId = args['org-id']
  const docBase = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`

  // 1. custom token -> ID token (authenticate as the seeded admin, no password)
  const customToken = await admin.auth().createCustomToken(uid)
  const signInRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  )
  const signInBody = await signInRes.json()
  if (!signInRes.ok) {
    console.error('Custom-token sign-in failed:', signInBody)
    process.exit(1)
  }
  const idToken = signInBody.idToken
  const authed = (extra = {}) => ({ Authorization: `Bearer ${idToken}`, ...extra })
  console.log(`\nSigned in as uid=${uid} (via custom token)\n`)

  // 2. POSITIVE reads — each depends on the relocated helpers resolving
  console.log('Reads (expected: allowed):')

  const ownUser = await fetch(`${docBase}/users/${uid}`, { headers: authed() })
  record(
    ownUser.status === 200,
    `GET users/${uid} (own record: userId == request.auth.uid)`,
    `HTTP ${ownUser.status}`,
  )

  const org = await fetch(`${docBase}/organizations/${orgId}`, { headers: authed() })
  record(
    org.status === 200,
    `GET organizations/${orgId} (sameOrg -> isActiveUser + callerOrgId + userDoc get())`,
    `HTTP ${org.status}`,
  )

  const listRes = await fetch(`${docBase}:runQuery`, {
    method: 'POST',
    headers: authed({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'users' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'organizationId' },
            op: 'EQUAL',
            value: { stringValue: orgId },
          },
        },
      },
    }),
  })
  const listBody = await listRes.json()
  const rows = Array.isArray(listBody) ? listBody.filter((r) => r.document) : []
  record(
    listRes.status === 200 && rows.length >= 1,
    `runQuery users where organizationId == org (staff read: isStaff + sameOrg)`,
    `HTTP ${listRes.status}, ${rows.length} row(s)`,
  )

  // 3. NEGATIVE write — self role escalation must be denied by the rules
  console.log('\nWrites:')
  const escalate = await fetch(`${docBase}/users/${uid}?updateMask.fieldPaths=role`, {
    method: 'PATCH',
    headers: authed({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ fields: { role: { stringValue: 'ADMIN' } } }), // same value, but touches 'role'
  })
  // Rule: self-update requires request.resource.data.role == resource.data.role.
  // Writing the SAME value should pass; to prove denial we try a changed value:
  const escalate2 = await fetch(`${docBase}/users/${uid}?updateMask.fieldPaths=role`, {
    method: 'PATCH',
    headers: authed({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ fields: { role: { stringValue: 'MANAGER' } } }),
  })
  record(
    escalate2.status === 403,
    `PATCH users/${uid} role ADMIN->MANAGER on self (expected: DENIED)`,
    `HTTP ${escalate2.status}`,
  )
  void escalate

  // 4. POSITIVE write — self-update that keeps role & org unchanged (allowed), then revert
  const setPhone = await fetch(`${docBase}/users/${uid}?updateMask.fieldPaths=phone`, {
    method: 'PATCH',
    headers: authed({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ fields: { phone: { stringValue: '+15550000000' } } }),
  })
  record(
    setPhone.status === 200,
    `PATCH users/${uid} phone on self, role/org unchanged (expected: ALLOWED)`,
    `HTTP ${setPhone.status}`,
  )
  if (setPhone.status === 200) {
    // revert: remove the phone field again via Admin SDK so the doc is back to seeded shape
    await admin.firestore().collection('users').doc(uid).update({
      phone: admin.firestore.FieldValue.delete(),
    })
    console.log(`  ↩ reverted: removed phone field from users/${uid}`)
  }

  const failed = results.filter((r) => !r.ok)
  console.log(
    `\n${failed.length === 0 ? '✔ RULES BEHAVE AS EXPECTED' : `✖ ${failed.length} CHECK(S) FAILED`} (${results.length} total)\n`,
  )
  process.exit(failed.length === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error('\n✖ Unexpected error:\n', error)
  process.exit(1)
})
