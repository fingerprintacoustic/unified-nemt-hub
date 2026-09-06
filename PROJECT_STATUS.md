# Project Status

Status log for the Unified NEMT Operations Hub. **Read this first at the start
of every session. Update it at the end of every session and whenever a
phase or task completes.** Keep it short — this is a log, not documentation.

_Last updated: 2026-09-05_

## Roadmap (12 phases)

| # | Phase | Status |
|---|---|---|
| 1 | Foundation | **DONE** |
| 2 | Auth / orgs / roles | **PARTIAL** |
| 3 | Vehicles / drivers | NOT STARTED |
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

### Phase 2 — Auth / orgs / roles: PARTIAL

**CONFIRMED WORKING against a real Firebase project (`nemt-hub-dev`):**
- Email/password login flow — in-app login test passed: signed in as the
  seeded ADMIN, correct organization resolved, ADMIN nav visible, no
  permission-denied.
- Role model (ADMIN > MANAGER > DISPATCHER > DRIVER) enforced in the app
  (`ProtectedRoute`, nav gating) and in `firestore.rules`.
- Organization scoping enforced in `firestore.rules` (every collection).
- `firestore.rules` deployed to `nemt-hub-dev`. Helper-function scope bug
  fixed (commit `1a2bdaa` — `$(database)` now resolves) and verified with an
  authenticated-client check (`scripts/verify-rules-client.mjs`).
- First-org / first-admin bootstrap seed script (`scripts/seed-organization.mjs`,
  commit `3662dee`) — run end-to-end against `nemt-hub-dev`: created
  `organizations/vDaohHxTqECFmLVGBr4T` + admin user
  `Py86U5SSX7WMtuSUOw41xusHueg1`. Doc shapes verified
  (`scripts/verify-seed.mjs`, 33/33). Re-run confirmed idempotent (no
  duplicates, no overwrites). Verification scripts committed in `d43a934`.

**NOT done:**
- No admin UI to manage users (list / invite / change role / deactivate).
  `src/pages/settings/SettingsPage.tsx` is still a placeholder.
  **Part B plan is approved (dedicated `/users` page, MANAGER+); not built.**

### Phases 3–12: NOT STARTED

## Open decisions / known gaps

- **Users admin screen (Phase 2 Part B): plan approved, NOT STARTED.**
  Dedicated `/users` route at `minRole: MANAGER`; list + change-role
  (ADMIN only) + activate/deactivate; new-user creation still needs a
  trusted server path (leaning: `scripts/create-user.mjs`, extending the
  seed-script pattern). No email/invite delivery wired.
- `firestore.rules` still emits 2 pre-existing compiler warnings, both
  unrelated to the scope fix: unused `isManagerOrAbove`, and a
  `diff(self)` no-op on the `auditLogs` key check (line ~242) that makes
  that key whitelist ineffective (does not grant extra access).
- No self-service password reset / profile update flow in the app.
  `scripts/set-user-password.mjs` is a dev-only helper (committed) for
  putting a known password on a freshly-seeded test account.
- `docs/fix-readme-code-fence` (`2d2b70c`) pushed, not yet merged to `main`.
- `AuthContext` still hardcodes `organization = null`; `/organizations/{orgId}`
  is not yet loaded on sign-in (login test confirmed the user doc + role
  resolve; the org record itself is not surfaced in context yet).

## Test data (nemt-hub-dev)

- Org: `organizations/vDaohHxTqECFmLVGBr4T` — "Test Org (seed check)"
- Admin: `users/Py86U5SSX7WMtuSUOw41xusHueg1` /
  `fingerprintacoustic+nemt-dev-admin@gmail.com` (ADMIN, ACTIVE)

## Last worked on / next step

- **Last:** confirmed Part A end-to-end — seed script + deployed rules work
  against `nemt-hub-dev`, in-app ADMIN login passed. Committed the rules
  scope fix (`1a2bdaa`) and verification scripts (`d43a934`).
- **Next:** build the Users admin screen (Phase 2 Part B) per the approved
  plan. Then Phase 2 is complete and Phase 3 (Vehicles/drivers) can start.
