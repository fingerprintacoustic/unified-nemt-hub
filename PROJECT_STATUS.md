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
| 3 | Vehicles / drivers | NOT STARTED ← next |
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

### Phases 3–12: NOT STARTED

## Open decisions / known gaps

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

- **Last:** built and verified the Users admin screen (Phase 2 Part B) —
  live list, role change, activate/deactivate, all exercised through the
  real deployed rules in-browser. Added `scripts/create-user.mjs`. Phase 2
  is now complete.
- **Next:** start Phase 3 — Vehicles / drivers (currently placeholder pages
  at `src/pages/vehicles/VehiclesPage.tsx` and `src/pages/drivers/DriversPage.tsx`).
