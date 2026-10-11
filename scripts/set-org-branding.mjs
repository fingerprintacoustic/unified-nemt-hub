#!/usr/bin/env node
/**
 * Personalize an organization for a demo: change the name shown in the app
 * and/or set its logo (Firebase Admin SDK; clients cannot write organization
 * documents, by design).
 *
 *   cd scripts
 *   node set-org-branding.mjs --list
 *   node set-org-branding.mjs --org-id <id> --name "Acme Medical Transport" --logo ./acme.png
 *   node set-org-branding.mjs --org-id <id> --remove-logo
 *   node set-org-branding.mjs --org-id <id> --name "Acme" --dry-run
 *
 * The logo is stored on the organization document as a data: URL, so keep it
 * small (max 200 KB; PNG, JPG, WebP or SVG). It shows in the sidebar and the
 * driver app header, on a white tile.
 */

import { existsSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, extname, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const MAX_LOGO_BYTES = 200 * 1024
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' }

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

function fail(message) {
  console.error(`\n✖ ${message}\n`)
  process.exit(1)
}

async function main() {
  loadDotEnv(join(scriptDir, '.env'))
  const { values: args } = parseArgs({
    options: {
      list: { type: 'boolean', default: false },
      'org-id': { type: 'string' },
      name: { type: 'string' },
      logo: { type: 'string' },
      'remove-logo': { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
    },
  })

  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (!credPath || !existsSync(resolve(credPath))) {
    fail('Service-account key not found. Set GOOGLE_APPLICATION_CREDENTIALS in scripts/.env.')
  }
  const serviceAccount = JSON.parse(readFileSync(resolve(credPath), 'utf8'))
  const { default: admin } = await import('firebase-admin')
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: serviceAccount.project_id })
  const db = admin.firestore()

  if (args.list) {
    const snap = await db.collection('organizations').get()
    for (const d of snap.docs) {
      const o = d.data()
      console.log(`${d.id}  ${o.name}${o.logoDataUrl ? '  (has logo)' : ''}`)
    }
    return
  }

  const orgId = args['org-id']
  if (!orgId) fail('Pass --org-id <id> (use --list to see them).')
  if (args.logo && args['remove-logo']) fail('Use either --logo or --remove-logo, not both.')
  if (!args.name && !args.logo && !args['remove-logo']) fail('Nothing to change: pass --name, --logo or --remove-logo.')

  const ref = db.collection('organizations').doc(orgId)
  const existing = await ref.get()
  if (!existing.exists) fail(`No organization with id ${orgId}.`)

  const update = {}
  if (args.name) {
    const name = args.name.trim()
    if (!name || name.length > 80) fail('--name must be 1-80 characters.')
    update.name = name
  }
  if (args.logo) {
    const file = resolve(args.logo)
    if (!existsSync(file)) fail(`Logo file not found: ${file}`)
    const mime = MIME[extname(file).toLowerCase()]
    if (!mime) fail('Logo must be .png, .jpg, .webp or .svg.')
    const size = statSync(file).size
    if (size > MAX_LOGO_BYTES) fail(`Logo is ${Math.round(size / 1024)} KB; the limit is ${MAX_LOGO_BYTES / 1024} KB. Export a smaller image.`)
    update.logoDataUrl = `data:${mime};base64,${readFileSync(file).toString('base64')}`
  }
  if (args['remove-logo']) update.logoDataUrl = admin.firestore.FieldValue.delete()
  update.updatedAt = admin.firestore.FieldValue.serverTimestamp()

  console.log(`Project: ${serviceAccount.project_id}`)
  console.log(`Organization: ${orgId} (currently "${existing.data().name}")`)
  console.log('Will change:', Object.keys(update).filter((k) => k !== 'updatedAt').join(', '))
  if (args['dry-run']) {
    console.log('\nDry run -- nothing changed.')
    return
  }
  await ref.update(update)
  console.log('\nDone. Refresh the app to see it.')
}

main().catch((error) => {
  console.error('\nFailed:\n', error)
  process.exit(1)
})
