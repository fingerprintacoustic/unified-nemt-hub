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
Done:
- Email/password login flow.
- Role model (ADMIN > MANAGER > DISPATCHER > DRIVER) enforced in the app
  (`ProtectedRoute`, nav gating) and in `firestore.rules`.
- Organization scoping enforced in `firestore.rules` (every collection).
- First-org / first-admin bootstrap seed script written — `scripts/seed-organization.mjs`,
  commit `3662dee`.

Not done:
- No admin UI to manage users (invite / list / change role / deactivate).
  `src/pages/settings/SettingsPage.tsx` is still a placeholder.
- Seed script has not been run against a real Firebase project (no `.env`
  with real credentials yet).

### Phases 3–12: NOT STARTED

## Open decisions / known gaps

- Seed script (`scripts/seed-organization.mjs`) is untested end-to-end —
  needs one real run against a Firebase project (or the emulators).
- No self-service password reset or profile update flow in the app; the
  seed script only prints a password-reset link for the first admin.
- No admin user-management UI (see Phase 2 "not done").
- `docs/fix-readme-code-fence` (`2d2b70c`) is pushed but not yet merged to
  `main` — a one-line README fence fix, safe to merge anytime.
- `AuthContext` still hardcodes `organization = null`; the
  `/organizations/{orgId}` record is not yet loaded on sign-in.

## Last worked on / next step

- **Last:** wrote the first-org bootstrap seed script (`3662dee`) and the
  local-preview shell guard (`d2308db`); added this status tracker.
- **Next:** decide the onboarding trigger for running the seed script, then
  run it once against a real Firebase project to create the first org +
  admin. After that, Phase 2's admin user-management UI.
