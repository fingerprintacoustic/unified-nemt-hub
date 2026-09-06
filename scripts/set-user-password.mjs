#!/usr/bin/env node
/**
 * Dev utility: set (or reset) a Firebase Auth user's password directly via the
 * Admin SDK. For local/dev testing only — production users set their own
 * password through the reset-link flow.
 *
 * Pairs with seed-organization.mjs: that script creates a test org + admin with
 * NO password (it only prints a reset link). Run this afterward to put a known
 * password on the freshly-seeded account so you can sign in to the app.
 *
 *   cd scripts
 *   node set-user-password.mjs --uid <uid>
 *   node set-user-password.mjs --email <email>
 *
 * The password is prompted for interactively (hidden, entered twice) — it is
 * never passed on the command line, so it never lands in shell history. When
 * stdin is not a TTY the password is read as a single line from stdin instead
 * (e.g. `node set-user-password.mjs --uid X < secret.txt`).
 *
 * Credentials: GOOGLE_APPLICATION_CREDENTIALS (or scripts/.env / --credentials).
 */

import { parseArgs } from 'node:util'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { stdin, stdout } from 'node:process'
import { createInterface } from 'node:readline'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const MIN_PASSWORD_LENGTH = 6

const KEY = { CTRL_C: 3, EOT: 4, BACKSPACE: 8, LF: 10, CR: 13, DEL: 127 }

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

/** Read one line with the characters hidden from the terminal. */
function promptHidden(label) {
  return new Promise((resolvePrompt, rejectPrompt) => {
    stdout.write(label)

    if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
      // Non-interactive: read a single line from stdin without masking.
      const rl = createInterface({ input: stdin })
      rl.once('line', (line) => {
        rl.close()
        stdout.write('\n')
        resolvePrompt(line)
      })
      rl.once('close', () => resolvePrompt(''))
      return
    }

    let value = ''
    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')

    const cleanup = () => {
      stdin.setRawMode(false)
      stdin.pause()
      stdin.removeListener('data', onData)
    }

    const onData = (chunk) => {
      for (const ch of chunk) {
        const code = ch.charCodeAt(0)
        if (code === KEY.CR || code === KEY.LF || code === KEY.EOT) {
          stdout.write('\n')
          cleanup()
          resolvePrompt(value)
          return
        }
        if (code === KEY.CTRL_C) {
          stdout.write('\n')
          cleanup()
          rejectPrompt(new Error('Cancelled.'))
          return
        }
        if (code === KEY.BACKSPACE || code === KEY.DEL) {
          value = value.slice(0, -1)
          continue
        }
        // Accept printable characters only; ignore other control bytes.
        if (code >= 32) value += ch
      }
    }

    stdin.on('data', onData)
  })
}

async function main() {
  loadDotEnv(join(scriptDir, '.env'))

  const { values: args } = parseArgs({
    options: {
      uid: { type: 'string' },
      email: { type: 'string' },
      'mark-verified': { type: 'boolean', default: true },
      credentials: { type: 'string' },
    },
  })

  if (!args.uid && !args.email) {
    console.error('Usage: node set-user-password.mjs (--uid <uid> | --email <email>)')
    process.exit(1)
  }

  const credPath = args.credentials || process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (!credPath || !existsSync(resolve(credPath))) {
    console.error('Service-account key not found. Set GOOGLE_APPLICATION_CREDENTIALS or scripts/.env.')
    process.exit(1)
  }
  const sa = JSON.parse(readFileSync(resolve(credPath), 'utf8'))

  const { default: admin } = await import('firebase-admin')
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id })
  const auth = admin.auth()

  // Resolve + show the target user before asking for a password.
  const user = args.uid ? await auth.getUser(args.uid) : await auth.getUserByEmail(args.email)
  console.log(`Target: ${user.email ?? '(no email)'}  (uid ${user.uid})\n`)

  const interactive = Boolean(stdin.isTTY && typeof stdin.setRawMode === 'function')

  const password = await promptHidden('New password: ')
  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(`\nPassword must be at least ${MIN_PASSWORD_LENGTH} characters (Firebase minimum).`)
    process.exit(1)
  }
  if (interactive) {
    const confirm = await promptHidden('Confirm password: ')
    if (password !== confirm) {
      console.error('\nPasswords did not match.')
      process.exit(1)
    }
  }

  const updated = await auth.updateUser(user.uid, {
    password,
    ...(args['mark-verified'] ? { emailVerified: true } : {}),
  })

  console.log(`\n✔ Password set for ${updated.email} (uid ${updated.uid})`)
  console.log(`  emailVerified: ${updated.emailVerified}`)
  console.log('\nSign in at /login with that email and the password you just set.\n')
  process.exit(0)
}

main().catch((error) => {
  console.error('\n✖ Failed:\n', error?.message ?? error)
  process.exit(1)
})
