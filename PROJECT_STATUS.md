# Project Status

Status log for the Unified NEMT Operations Hub. **Read this first at the start
of every session. Update it at the end of every session and whenever a
phase or task completes.** Keep it short — this is a log, not documentation.

_Last updated: 2026-09-16_

## Roadmap (12 phases)

| # | Phase | Status |
|---|---|---|
| 1 | Foundation | **DONE** |
| 2 | Auth / orgs / roles | **DONE** |
| 3 | Vehicles / drivers | **PARTIAL** ← blocked on a rules bug, see below |
| 4 | Trips / dispatch | NOT STARTED |
| 5 | Driver PWA | NOT STARTED |
| 6 | Inspections | NOT STARTED |
| 7 | Navigation / comms | NOT STARTED |
| 8 | Telematics | NOT STARTED |
| 9 | Payroll | NOT STARTED |
| 10 | Billing / reports | NOT STARTED |
| 11 | Audit / compliance | NOT STARTED |
| 12 | Production deploy | NOT STARTED |

## Detail

### Phase 1 — Foundation: DONE
Commits `bc88131`, `8d10662`, `d2308db`. Firebase security rules foundation,
service-worker syntax fix, and local-preview shell access when Firebase is
unconfigured.

### Phase 2 — Auth / orgs / roles: DONE

- Email/password login flow — in-app login test passed against a real
  Firebase project (`nemt-hub-dev`).
- Role model (ADMIN > MANAGER > DISPATCHER > DRIVER), enforced in the app
  (`ProtectedRoute`, nav gating) and in `firestore.rules`.
- Organization scoping enforced in `firestore.rules` (every collection).
- `firestore.rules` deployed to `nemt-hub-dev`; helper-function scope bug
  fixed (`1a2bdaa`) and verified with an authenticated-client check
  (`scripts/verify-rules-client.mjs`).
- First-org/first-admin bootstrap (`scripts/seed-organization.mjs`) — run
  end-to-end, verified, idempotent.
- **Users admin screen** (`/users`, `src/pages/users/UsersPage.tsx`,
  `minRole: MANAGER`): lists an org's users live, lets an ADMIN change a
  user's role and MANAGER+ activate/deactivate. Purely a frontend for what
  `firestore.rules` already allows — no rules changes needed. Self-role and
  self-status controls are hidden (rules already block self-escalation; the
  UI just doesn't offer it). Verified end-to-end through the real deployed
  rules in-browser (role change + deactivate/reactivate), not just the Admin
  SDK.
- `scripts/create-user.mjs` — adds a user to an **existing** org (Auth user +
  `users/{uid}` doc); the Users screen shows the exact command, pre-filled
  with the org id. Creating a brand-new user still needs this script (or
  `seed-organization.mjs` for a new org) because a browser can't create a
  Firebase Auth account for someone else.

### Phase 3 — Vehicles / drivers: PARTIAL

- `src/pages/drivers/DriversPage.tsx` and `src/pages/vehicles/VehiclesPage.tsx`
  replace the old placeholders: live list, add, edit, and status-change all
  work and were verified in-browser against the deployed `nemt-hub-dev`
  rules (`bb41329`).
- **Delete does not work for either collection — confirmed via live testing,
  not just reading the rules.** `firestore.rules`' `drivers` and `vehicles`
  `allow update, delete` clauses both require
  `sameOrg(request.resource.data.organizationId)`, but `request.resource` is
  null on a delete, so the check always fails and every delete attempt gets
  `permission-denied`. (`users`' delete rule does this correctly — it only
  checks `resource.data`, not `request.resource.data`.) Not fixed — needs
  the same kind of authorization the `$(database)` scope fix got before
  touching `firestore.rules` again. UI already restricts Delete to ADMIN;
  DISPATCHER/MANAGER only get the status dropdown either way.
- Driver-to-login linking (`DriverRecord.userId`) is a manual dropdown of
  existing DRIVER-role users — no auto-provisioning flow.
- Not built: search/filter beyond the full list, and nothing from the old
  placeholder copy that isn't in the schema (background checks, document
  management, maintenance history) — see prior scoping message.

### Phases 4–12: NOT STARTED

## Open decisions / known gaps

- **`firestore.rules` delete bug (drivers/vehicles) — needs authorization to
  fix.** See Phase 3 detail above. Likely fix: split `update` and `delete`
  into separate `allow` statements so `delete` only checks
  `resource.data.organizationId`, mirroring how `users`' delete rule is
  already written.
- No self-service password reset / profile update flow in the app (admin
  invite still ends with a printed reset link, delivered manually).
  `scripts/set-user-password.mjs` is a dev-only helper for setting a known
  password on a test account.
- No email/invite delivery wired (Resend etc.) — new-user creation prints a
  link rather than emailing one.
- `firestore.rules` still emits 2 pre-existing compiler warnings, unrelated
  to anything fixed so far: unused `isManagerOrAbove`, and a `diff(self)`
  no-op on the `auditLogs` key check (line ~242) that makes that key
  whitelist ineffective (does not grant extra access).
- `docs/fix-readme-code-fence` (`2d2b70c`) pushed, not yet merged to `main`.
- `AuthContext` still hardcodes `organization = null`; `/organizations/{orgId}`
  is not yet loaded on sign-in (role/org id resolve fine via `userRecord`;
  the org record itself isn't surfaced in context).
- This machine's Firebase CLI needed `firebase login:use musiiwajoseph@gmail.com`
  to reach `nemt-hub-dev` (that account owns it, not `fingerprintacoustic@gmail.com`).
  Set per-directory via `.firebaserc`/CLI default; no ownership changes made.

## Test data (nemt-hub-dev)

- Org: `organizations/vDaohHxTqECFmLVGBr4T` — "Test Org (seed check)"
- Admin: `users/Py86U5SSX7WMtuSUOw41xusHueg1` /
  `fingerprintacoustic+nemt-dev-admin@gmail.com` (ADMIN, ACTIVE). Password was
  reset during Users-screen verification (2026-09-16) — change it again via
  `scripts/set-user-password.mjs` before relying on it.

## Last worked on / next step

- **Last:** built Drivers and Vehicles CRUD screens (Phase 3) — list, add,
  edit, and status-change verified end-to-end in-browser. Found and
  confirmed (not fixed) a `firestore.rules` bug that blocks delete on both
  collections.
- **Next:** get authorization to fix the drivers/vehicles delete rule, then
  Phase 3 is done. After that: Phase 4 — Trips / dispatch.
