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
| 3 | Vehicles / drivers | **DONE** |
| 4 | Trips / dispatch | **DONE** |
| 5 | Driver PWA | **DONE** |
| 6 | Inspections | **DONE** |
| 7 | Navigation / comms | **DONE** (navigation only; comms deferred) |
| 8 | Telematics | **DEFERRED** — no real provider account yet (see below) |
| 9 | Payroll | **DONE** (manual pay entry; no auto-calculation) |
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

### Phase 3 — Vehicles / drivers: DONE

- `src/pages/drivers/DriversPage.tsx` and `src/pages/vehicles/VehiclesPage.tsx`
  replace the old placeholders: live list, add, edit, status-change, and
  delete all verified end-to-end in-browser against the deployed
  `nemt-hub-dev` rules (`bb41329`, `e980935`).
- Fixed a real `firestore.rules` bug found during that verification: `drivers`
  and `vehicles` combined `allow update, delete` under a condition that
  checked `request.resource.data.organizationId`, which is null on a delete,
  so every delete was silently denied. Split into separate `update`/`delete`
  allow blocks (`e980935`) — no change to who's authorized, purely a
  null-reference fix. Redeployed and re-verified: create, edit, status
  change, and delete all round-trip correctly for both collections now.
  UI still restricts the Delete button to ADMIN (stricter than the rules
  require) — DISPATCHER/MANAGER only get the status dropdown.
- The identical bug also existed on `locations/{locationId}` (no UI yet).
  Fixed the same way and verified directly — signed in as the seeded admin
  via a custom token and hit the Firestore REST API to create then delete a
  location document; both succeeded (`f6a2ed5`). All four collections
  (`drivers`, `vehicles`, `locations`, plus `users` which was already
  correct) now have working delete rules.
- Driver-to-login linking (`DriverRecord.userId`) is a manual dropdown of
  existing DRIVER-role users — no auto-provisioning flow.
- Not built: search/filter beyond the full list, and nothing from the old
  placeholder copy that isn't in the schema (background checks, document
  management, maintenance history) — see prior scoping message.

### Phase 4 — Trips / dispatch: DONE

- `src/pages/trips/TripsPage.tsx`: full trip record management (schedule,
  addresses, mobility needs, driver/vehicle, status, fare, distance/duration,
  broker, notes). `firestore.rules`' `trips` rule was already correct
  (delete already split from update) — no rules change needed here.
- `src/pages/dispatch/DispatchPage.tsx`: operational board of trips not yet
  COMPLETED/CANCELLED/NO_SHOW, sorted soonest-first, with inline
  driver/vehicle quick-assign (bumps SCHEDULED→ASSIGNED as a UI convenience)
  and unassign.
- **Google Maps Geocoding integration** (`src/lib/googleMaps.ts`,
  `src/services/geocoding.ts`, `VITE_GOOGLE_MAPS_API_KEY`). `TripRecord`
  requires a `GeoPoint` for origin/destination, separate from the free-text
  address fields, and this app had no geocoding before. Direct
  browser-to-Google-Maps-JS-API call with a referrer-restricted key (no
  Cloud Function proxy) — decided explicitly. **Key created and set
  2026-09-16** — Geocoding API + Maps JavaScript API enabled on
  `nemt-hub-dev` (the production project), key restricted to those two APIs
  and to `http://localhost:5173/*` (add the production domain's referrer
  when that domain exists). Billing on `nemt-hub-dev` was already linked
  (shared "Firebase Payment" billing account); a budget alert was
  recommended.
- **Verified live with the real key**: entered "1600 Amphitheatre Parkway,
  Mountain View, CA" and "1 Infinite Loop, Cupertino, CA" in the trip form,
  clicked Verify on each, got back correct formatted addresses, submitted,
  and confirmed the exact real-world coordinates
  (37.4224864, -122.0855962 / 37.3318598, -122.0302485) were written to
  the trip's `origin`/`destination` GeoPoints in Firestore. The manual
  lat/lng fallback path (used when the key isn't set) was verified earlier
  and still works if the key is ever removed.
- **Not built:** automatic distance/duration calculation (would need a
  separate Distance Matrix–type API call — not requested, not added).
- **Bug found and fixed while scoping Phase 5, see below:** the driver
  assignment dropdowns on this page and Dispatch were storing the wrong
  value in `TripRecord.driverId`.

### Phase 5 — Driver PWA: DONE

- **Fixed a real bug from this Phase 4 work** (`710cd30`): `firestore.rules`
  compares a trip's `driverId` directly to `request.auth.uid` for a driver's
  own-trip access, but `TripsPage`/`DispatchPage` were storing
  `DriverRecord.driverId` (that record's own Firestore doc id) instead of
  `DriverRecord.userId` (the linked login's Auth uid) — two unrelated ID
  namespaces. Any trip assigned via Phase 4's UI would have been permanently
  invisible to the actual driver. Caught this because Phase 4's own
  verification only ran as ADMIN, which bypasses the `isDriver()` branch
  entirely. No production data was affected (no real driver had been
  assigned a trip yet). Fixed in both pages; the assignment dropdowns now
  also filter to drivers who have a linked login, with a note when some
  don't.
- `src/pages/driver/DriverHomePage.tsx`: the driver's own live trip list
  (`src/services/trips.ts` `observeMyTrips`), each trip as a card with a
  single "next status" button (Start trip → Mark picked up → Mark dropped
  off → Mark completed) via the existing `setTripStatus`. Dispatch-only
  decisions (SCHEDULED→ASSIGNED, CANCELLED, NO_SHOW) aren't offered to
  drivers. Completed/cancelled trips move to a compact history list.
  `firestore.rules` needed no changes — a driver-authored partial update
  that only touches `status` already satisfies the rule requiring
  `driverId`/`vehicleId`/`organizationId` to stay unchanged.
- **Verified as a real DRIVER-role account, not the admin bypass:** created
  a driver+vehicle+trip as ADMIN, linked the driver's HR record to a
  DRIVER-role login (the Users-page dropdown from Phase 3), assigned via
  Dispatch, then signed in as that driver and progressed the trip
  SCHEDULED→EN_ROUTE→PICKED_UP→DROPPED_OFF→COMPLETED end-to-end, confirmed
  in Firestore at each step, watched it move to history on completion.
- Inspections tab stays a placeholder — that's Phase 6.

### Phase 6 — Inspections: DONE

- `src/services/inspections.ts`: `newInspectionId()` (reserves a doc id up
  front so Storage uploads have a stable path before the Firestore doc
  exists), `observeOrgInspections` (staff), `observeMyInspections` (driver,
  `driverId == own uid`), `createInspection`, `reviewInspection`
  (staff approve/flag), `deleteInspection`. `firestore.rules`' inspections
  rule was already correct — no changes needed.
- `src/pages/driver/DriverInspectionsPage.tsx`: pre-trip/post-trip form —
  vehicle picker, optional link to one of the driver's own active trips,
  odometer, GPS via `navigator.geolocation` (optional, never blocks
  submit), 5-point condition ratings + safety equipment, damage notes,
  photo/video upload through the Phase-1 `storage.ts`/`storage.rules`
  plumbing, required driver-confirmation checkbox. `flagged` auto-sets from
  any SEVERE damage note, POOR rating, or missing safety equipment — a UI
  convenience, not rules-enforced.
- `src/pages/inspections/InspectionsPage.tsx`: staff list + detail view,
  Approve/Flag actions. **Approving also calls the new
  `setVehicleLastInspection()`** (`src/services/vehicles.ts`) — closes the
  loop on `VehicleRecord.lastInspectionAt`, which Phase 3 left read-only
  pending this. Only staff can write vehicles, so the bump happens at
  review time, not driver submission.
- **Two simplifications, not built:** no signature pad
  (`driverSignatureUrl` stays unset — the confirmation checkbox is the only
  attestation); damage-note photos aren't wired per-note (`photoUrls`
  always `[]`) — only the inspection-level `media[]` array is used.
- **Verified as a real DRIVER-role account:** submitted a pre-trip
  inspection with a POOR brake rating and a SEVERE damage note, confirmed
  `flagged: true` was auto-set and the Firestore write matched the schema
  exactly. Then as staff: resolved to the right vehicle/driver names,
  approved it, confirmed the vehicle's "Last inspection" column updated.
  **Not exercised by browser automation:** an actual file upload (the
  automation tool has no file-input capability) and GPS capture (no real
  device location) — both call pre-existing, already-reviewed helpers with
  no new logic of their own.
- **Sign-out gap noticed here, fixed later (`86692b3`):** `DriverLayout.tsx`
  had no sign-out control at all. See "Last worked on" below.

### Phase 7 — Navigation / comms: DONE (navigation only; comms deferred)

Unlike every phase before it, this one had **no existing schema, rules, or
dedicated page** to build against — scoped explicitly with the user before
writing anything.

- **Navigation (done):** `src/lib/navigation.ts` — `buildDirectionsUrl()`
  (Google's documented cross-platform directions URL, no API key/Maps
  Platform call needed) and `navigationTargetForTrip()`, which points at
  the origin while SCHEDULED/ASSIGNED/EN_ROUTE and the destination once
  PICKED_UP. A "Navigate to pickup/dropoff" link now sits next to the
  status button on each driver trip card (`DriverHomePage.tsx`). Verified
  as a real DRIVER-role account through the full lifecycle — confirmed
  the link's coordinates match the trip's origin/destination exactly at
  each stage, and disappears once dropped off.
- **Comms: explicitly deferred**, per the user's own call. Would need a
  new `messages`/`notifications` collection, new `firestore.rules`, and
  real-time UI on both the Dispatch and Driver PWA sides — treated as its
  own future decision, not bundled in here.
- **Real `firestore.rules` bug found while testing navigation, fixed
  same session (`aec5327`).** The `trips` driver-update branch compared
  `request.resource.data.vehicleId == resource.data.vehicleId` to stop a
  driver reassigning their own trip's vehicle. When `vehicleId` was
  **entirely absent** from the document (a trip can have a driver assigned
  without a vehicle yet — `vehicleId` is optional), that comparison denied
  the whole branch — confirmed via an isolated REST test (custom-token
  sign-in as a real DRIVER-role test account), `403` before the fix. Fixed
  by comparing with `get('vehicleId', null)` on both sides instead of a
  bare property access — same authorization, just safe against the field
  being absent. Redeployed and re-verified both directions: a status
  update on a vehicle-less trip now succeeds (`200`), and an actual
  attempt to set `vehicleId` (real reassignment) still gets denied
  (`403`) — the fix didn't loosen anything.
- This machine's Firebase CLI needed `firebase login:use
  musiiwajoseph@gmail.com` re-set **again** after the project relocation
  below — the per-directory default account doesn't carry over when the
  project folder moves. Worth remembering if `firebase deploy` ever
  suddenly 403s again.

### Phase 8 — Telematics: DEFERRED

Scoped and explicitly deferred by the user (2026-09-16), not skipped by
default. Same situation as Phase 7 was before scoping: no existing
schema/rules/page — only a one-off `gpsLocation` snapshot on
`InspectionRecord`, nothing live. Live vehicle position/speed/ignition
needs a real fleet-telematics provider account (the README already names
"Verizon GPS" as a planned adapter target) with its own API
credentials/OAuth, typically an enterprise contract — not something
settable up the way the Maps key was. Options when this gets revisited:
(a) schema + UI scaffolding fed by manual/simulated data now, real
provider swapped in later as one adapter per the README's stated
architecture, or (b) wait for actual provider access and scope a real
integration against that API. No code written for this phase.

### Phase 9 — Payroll: DONE (manual pay entry; no auto-calculation)

Genuinely new schema + rules from scratch (like Phase 7/8), scoped with the
user first: **pay amounts are entered manually by staff, not calculated**
— how a driver's pay is derived from trips (flat/hourly/percentage/etc.)
is a real compensation decision this app doesn't make.

- `src/types/index.ts`: `PayrollPeriodRecord` (status DRAFT/APPROVED/
  EXPORTED, `entries: PayrollEntry[]` where each entry is `{driverId
  (Auth uid), amount: Money, notes?}`, `createdBy`/`approvedBy`/
  `approvedAt`).
- `firestore.rules`: new `payrollPeriods` match block, gated to
  `isManagerOrAbove()` — not `isStaff()` — per the README's own stated
  role boundary ("MANAGER -- payroll, billing, reports", distinct from
  DISPATCHER's domain). Create requires `status == 'DRAFT'`; delete is
  ADMIN-only. This also put the long-unused `isManagerOrAbove()`
  function to work, clearing one of the two pre-existing compiler
  warnings (only the `auditLogs` `diff(self)` one remains).
- `src/pages/payroll/PayrollPage.tsx` / `src/services/payroll.ts`: list
  of periods; a detail view listing every DRIVER-role user with an
  editable amount + notes (locked once approved) and a **reference-only**
  count of their COMPLETED trips in that date range — shown for context,
  never used to compute the amount. Approve/Export/Reopen workflow;
  CSV export is generated client-side from data already on screen (no
  vendor integration) and marks the period EXPORTED.
- **Verified with real MANAGER, DISPATCHER, and ADMIN accounts** (not
  the seeded-admin bypass): MANAGER completed the full
  create→save→approve→export→reopen lifecycle with an entry persisting
  correctly throughout; DISPATCHER was blocked both by the route guard
  *and* with a `403` at the rules level on a direct read and a
  collection query against a real document; ADMIN could delete a DRAFT
  period while the delete control didn't even render for the MANAGER
  account.
- **Not built:** a driver-facing "my pay" view (this phase's placeholder
  text framed payroll as a staff/management workflow — approvals,
  export — not driver self-service; no such view was requested).

### Phases 10–12: NOT STARTED

## Open decisions / known gaps

- **Google Maps key referrer list is dev-only.** Only `http://localhost:5173/*`
  is on the key's allowed-websites list right now (Phase 4 detail above).
  Add the production domain's referrer once one exists, or geocoding will
  fail there (falls back to nothing — the UI will show a "could not
  verify" error, not manual entry, since the key IS configured).
- No self-service password reset / profile update flow in the app (admin
  invite still ends with a printed reset link, delivered manually).
  `scripts/set-user-password.mjs` is a dev-only helper for setting a known
  password on a test account.
- No email/invite delivery wired (Resend etc.) — new-user creation prints a
  link rather than emailing one.
- `firestore.rules` still emits 1 pre-existing compiler warning (down from
  2 — Phase 9 put `isManagerOrAbove()` to use): a `diff(self)` no-op on
  the `auditLogs` key check that makes that key whitelist ineffective
  (does not grant extra access).
- `docs/fix-readme-code-fence` (`2d2b70c`) pushed, not yet merged to `main`.
- `AuthContext` still hardcodes `organization = null`; `/organizations/{orgId}`
  is not yet loaded on sign-in (role/org id resolve fine via `userRecord`;
  the org record itself isn't surfaced in context).
- This machine's Firebase CLI needed `firebase login:use musiiwajoseph@gmail.com`
  to reach `nemt-hub-dev` (that account owns it, not `fingerprintacoustic@gmail.com`).
  Set per-directory via `.firebaserc`/CLI default; no ownership changes made.
- **Project relocated 2026-09-16**: moved from
  `Downloads\unified-nemt-hub-ready-to-push\unified-nemt-hub` to
  `StudioProjects\unified-nemt-hub` (alongside the user's other projects).
  Git/build/service-account key all verified working at the new path. Note
  for future sessions: the terminal (Bash/PowerShell) and the browser-preview
  tool can end up pointed at different directories after a mid-session
  move — confirm `preview_list`'s reported `cwd` matches before trusting a
  browser-based verification.

## Test data (nemt-hub-dev)

- Org: `organizations/vDaohHxTqECFmLVGBr4T` — "Test Org (seed check)"
- Admin: `users/Py86U5SSX7WMtuSUOw41xusHueg1` /
  `fingerprintacoustic+nemt-dev-admin@gmail.com` (ADMIN, ACTIVE). Password was
  reset during Users-screen verification (2026-09-16) — change it again via
  `scripts/set-user-password.mjs` before relying on it.

## Last worked on / next step

- **Last:** Phase 8 (Telematics) scoped and deferred (no provider yet).
  Phase 9 (Payroll) built and verified — manual pay entry, new schema +
  `payrollPeriods` rules, tested against real MANAGER/DISPATCHER/ADMIN
  accounts including a rules-level (not just UI) permission check.
- **Next:** Phase 10 — Billing / reports. Also remember to add the
  production domain to the Maps key's referrer list once one exists, and
  to revisit Phase 8 once a real telematics provider is in place.
