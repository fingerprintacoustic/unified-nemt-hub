# scripts/

Local-only operational scripts. **Not part of the application** — separate
dependency tree (`scripts/package.json`), never bundled by Vite, never deployed.

## seed-organization.mjs — first-org / first-admin bootstrap

`firestore.rules` denies all client writes to `organizations`, and only an
existing ACTIVE staff user can create a `users/{uid}` document. A brand-new
customer therefore has no way to get its first admin into the system. This
script is the trusted server-side path that closes that gap: it uses the
Firebase Admin SDK (which bypasses security rules) to create, for one new
customer at a time:

1. one `organizations/{orgId}` document (`OrganizationRecord`)
2. one Firebase Auth user for the first admin (or reuses an existing one)
3. one `users/{uid}` document with `role: "ADMIN"`, `status: "ACTIVE"`,
   `organizationId` set to the new org

It is safe to re-run: each of the three entities is get-or-create, and it
refuses to modify an Auth user or `users/{uid}` document that already exists
with different data.

### One-time setup

1. **Get a service-account key**
   Firebase Console → Project settings → Service accounts → *Generate new
   private key*. Save the JSON file **outside this repository** if you can
   (e.g. `~/.config/nemt-hub/serviceAccount.json`). If you must keep it under
   `scripts/`, the name patterns in the repo `.gitignore`
   (`serviceAccount*.json`, `*-service-account.json`, `scripts/secrets/`)
   keep it out of git — but outside the tree is safer.

2. **Point the script at it**

   ```
   cd scripts
   cp .env.example .env
   # edit scripts/.env:  GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/serviceAccount.json
   ```

   `scripts/.env` is git-ignored. You can also pass `--credentials <path>` on
   the command line instead of using `.env`.

3. **Install dependencies** (isolated from the app)

   ```
   cd scripts
   npm install
   ```

### Onboard a customer

Always dry-run first:

```
cd scripts
node seed-organization.mjs \
  --org-name "Acme Medical Transport" \
  --org-timezone "America/New_York" \
  --admin-email "jane@acme.example" \
  --admin-first-name "Jane" \
  --admin-last-name "Doe" \
  --dry-run
```

Review the printed "Planned writes", then run the same command without
`--dry-run`.

If the script created the Auth user, it prints a password-reset link — send
that to the admin so they set their own password. (No email is sent
automatically; no password is ever entered into or stored by this script.)

### Inputs

| Flag | Required | Writes to |
| --- | --- | --- |
| `--org-name` | yes | `organizations.name` |
| `--org-timezone` | yes | `organizations.timezone` (IANA, e.g. `America/New_York`) |
| `--admin-email` | yes | Firebase Auth email + `users.email` |
| `--admin-first-name` | yes | `users.firstName` |
| `--admin-last-name` | yes | `users.lastName` |
| `--org-id` | no | `organizations/{id}` (doc id) + `organizations.organizationId` + `users.organizationId`. Omitted → new auto-id; aborts if an org with the same `--org-name` already exists. |
| `--org-legal-name` | no | `organizations.legalName` |
| `--org-phone` | no | `organizations.phone` |
| `--org-email` | no | `organizations.email` |
| `--org-address-line1` / `-line2` / `-city` / `-state` / `-zip` / `-country` | no | `organizations.address` — written only if line1/city/state/zip/country are all provided (line2 optional) |
| `--admin-phone` | no | `users.phone` |
| `--existing-uid` | no | Reuse an existing Firebase Auth user instead of email lookup/creation |
| `--credentials` | no | Service-account key path (else `GOOGLE_APPLICATION_CREDENTIALS`) |
| `--project` | no | Project id — only needed for emulator runs |
| `--dry-run` | no | Print planned writes, change nothing |
| `--help` | no | Usage |

### Fields written

**`organizations/{orgId}`** — `organizationId` (= doc id), `name`, `status`
(`"ACTIVE"`), `timezone`, `createdAt`/`updatedAt` (server timestamp), plus any
of `legalName`, `phone`, `email`, `address` that were supplied.

**`users/{uid}`** (doc id = Firebase Auth UID) — `uid` (= doc id),
`organizationId` (= org doc id), `role` (`"ADMIN"`), `status` (`"ACTIVE"`),
`firstName`, `lastName`, `email`, `createdAt`/`updatedAt` (server timestamp),
plus `phone` if supplied. `photoURL` and `driverId` are not set.

**Firebase Auth user** — `email`, `displayName` (`"First Last"`),
`emailVerified: false`. No password (reset link generated instead).

No `auditLogs` entry is written — a headless seed has no authenticated actor.

### How re-running avoids duplicates

- **Auth user** — `--existing-uid` → `getUser`; else `getUserByEmail`; only
  creates when neither resolves. A `--existing-uid` whose email disagrees with
  `--admin-email` aborts.
- **Organization** — `--org-id` that already exists is reused, never
  overwritten. Without `--org-id`, a name collision aborts with the existing
  id so you can re-target with `--org-id`.
- **`users/{uid}`** — already exists and matches (same org, ADMIN, ACTIVE) →
  skipped. Exists but differs → aborts; the script never mutates an existing
  user document.
- The org and user documents are committed in one batch, so a new org is
  never left without its admin.

### Run against local emulators (optional test)

```
# terminal 1
firebase emulators:start --only auth,firestore

# terminal 2
cd scripts
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
node seed-organization.mjs --project demo-nemt-hub \
  --org-name "Test Org" --org-timezone "America/New_York" \
  --admin-email "admin@test.example" --admin-first-name "Test" --admin-last-name "Admin"
```
