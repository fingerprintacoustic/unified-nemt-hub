#!/usr/bin/env node
/**
 * Enforce a stronger, server-side password policy on this Firebase project's
 * Authentication config (Admin SDK `projectConfigManager().updateProjectConfig`).
 *
 * Firebase Auth's own default (6 characters, no complexity requirement) is
 * enforced by Google's servers regardless of any client-side validation the
 * app adds -- the only way to actually raise the bar is this project-level
 * config, not app code. Run once per project; the policy then applies to
 * every sign-up and password change/reset going forward.
 *
 * `forceUpgradeOnSignin: true` does not lock anyone out immediately -- an
 * existing user whose password predates this policy is prompted to set a
 * compliant one the next time they sign in, not on this run.
 *
 *   cd scripts
 *   node set-password-policy.mjs
 *   node set-password-policy.mjs --dry-run
 */

import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'

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

async function main() {
  loadDotEnv(join(scriptDir, '.env'))
  const { values: args } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false } } })

  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (!credPath || !existsSync(resolve(credPath))) {
    console.error('Service-account key not found. Set GOOGLE_APPLICATION_CREDENTIALS in scripts/.env.')
    process.exit(1)
  }
  const serviceAccount = JSON.parse(readFileSync(resolve(credPath), 'utf8'))

  const { default: admin } = await import('firebase-admin')
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: serviceAccount.project_id })

  const policy = {
    passwordPolicyConfig: {
      enforcementState: 'ENFORCE',
      forceUpgradeOnSignin: true,
      constraints: {
        requireUppercase: true,
        requireLowercase: true,
        requireNumeric: true,
        requireNonAlphanumeric: true,
        minLength: 12,
      },
    },
  }

  console.log(`Project: ${serviceAccount.project_id}`)
  console.log('Planned password policy:', JSON.stringify(policy, null, 2))

  if (args['dry-run']) {
    console.log('\nDry run -- nothing changed.')
    process.exit(0)
  }

  const result = await admin.auth().projectConfigManager().updateProjectConfig(policy)
  console.log('\nApplied. Current policy:', JSON.stringify(result.passwordPolicyConfig, null, 2))
}

main().catch((error) => {
  console.error('\nFailed to update password policy:\n', error)
  process.exit(1)
})
