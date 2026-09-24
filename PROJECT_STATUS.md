# Project Status

Status log for the Unified NEMT Operations Hub. **Read this first at the start
of every session. Update it at the end of every session and whenever a
phase or task completes.** Keep it short — this is a log, not documentation.

_Last updated: 2026-09-17_

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
| 8 | Telematics | **PARTIAL** — manual/scaffolding only; real Verizon Connect sync still needs a provider account |
| 9 | Payroll | **DONE** (manual pay entry; no auto-calculation) |
| 10 | Billing / reports | **DONE** (CSV export only; no vendor sync yet) |
| 11 | Audit / compliance | **PARTIAL** — audit trail wired + viewer built; password policy + idle timeout hardened; BAA execution/determination still the client's call |
| 12 | Production deploy | **PARTIAL** — live on Firebase Hosting; no custom domain yet |

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

### Phase 8 — Telematics: PARTIAL (manual scaffolding; no live provider)

Originally deferred (2026-09-16) — no real fleet-telematics provider
account existed yet, and live position/speed/ignition needs one (the
README names "Verizon GPS" as the planned adapter target; Verizon
Connect's Reveal platform is a documented REST API covering vehicle
position/history, speed, ignition, and geofence/idling/speeding alerts,
per a check of their public API docs). Two options were on the table:
(a) build schema + UI scaffolding fed by manual data now, real provider
swapped in later as one adapter, or (b) wait entirely for provider
access. **Chose (a)** on 2026-09-17, same reasoning as Payroll/Billing's
derive-don't-invent pattern.

- `src/types/index.ts`: `VehicleRecord.telemetry?: VehicleTelemetry`
  (position, positionAddress, speedMph, ignitionOn, recordedAt, `source:
  'MANUAL' | 'VERIZON_CONNECT'`, updatedBy). A snapshot field, not a
  time-series collection — deliberately minimal since a real provider
  integration would likely want its own event-log shape anyway; no sense
  building history storage now that gets thrown away later.
- `src/services/vehicles.ts`: `setVehicleTelemetry()`, its own function
  like `setVehicleLastInspection()` so `source`/`recordedAt` stay honest.
- `src/pages/vehicles/VehiclesPage.tsx`: "Update status" action (any
  staff role) opens a small form — address (geocoded via the existing
  `geocodeAddress()`, same Verify-button UX as Trips), speed, ignition
  toggle. The fleet table shows a "Last known status" column: ignition
  badge, speed, how long ago, and a "view position" link reusing Phase
  7's `buildDirectionsUrl()`.
- **No `firestore.rules` change needed** — `telemetry` is just another
  field under the vehicles collection's existing staff-write rule.
- **Verified as a real DISPATCHER account** (not admin bypass): set a
  vehicle's status to "500 Main St, Springfield, IL" / 32 mph / ignition
  on, watched it geocode, save, and render correctly in the fleet table
  with a working Maps link to the exact verified coordinates.
- **Still open:** an actual Verizon Connect account. When one exists,
  the swap is: a background job writes to the same `telemetry` field with
  `source: 'VERIZON_CONNECT'` instead of staff typing it in — no schema,
  rules, or UI change needed on this end.

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

### Phase 10 — Billing / reports: DONE (CSV export; no vendor sync)

Client confirmed (2026-09-16) they have their own existing billing system
and other software to integrate with, exact names not yet given. Built to
the same safe default used for Payroll rather than guessing a vendor:
trip/fare data already in the app, exported at the boundary — no invented
formula, no invented API integration.

- `src/types/index.ts`: `BillingPeriodRecord` (status DRAFT/FINALIZED/
  EXPORTED), `BillingLineItem[]` snapshotted at finalize time so a later
  trip edit/delete can't change numbers already sent out. `totalAmount`
  and every line item's `fare` come directly from `TripRecord.fare` —
  this app computes nothing.
- `firestore.rules`: new `billingPeriods` match block, `isManagerOrAbove()`
  gated (README: "MANAGER -- payroll, billing, reports"), same shape as
  `payrollPeriods` (create requires DRAFT, delete ADMIN-only).
- `src/services/billing.ts` / `src/pages/billing/BillingPage.tsx`: create
  a period (date range + optional broker-ID filter, matching the free-text
  `brokerId` field trips already have); while DRAFT, a live preview of
  every COMPLETED trip with a fare that matches; Finalize locks the
  snapshot; Export CSV (broker portal / QuickBooks import shape: trip id,
  date, origin, destination, broker, fare) marks it EXPORTED.
- `src/pages/reports/ReportsPage.tsx`: read-only dashboard (date-range
  filtered) over trips/vehicles/inspections already in the system — trip
  volume by status, completion rate, fared revenue, fleet utilization,
  inspection flag rate. No new collection, no new rules; reuses existing
  `isStaff()` reads.
- **Verified with real MANAGER/DISPATCHER accounts** (new test users this
  session, see below): MANAGER created a real driver/vehicle/COMPLETED
  trip with a $45 fare and broker "BrokerA", saw it appear live in the
  Reports dashboard and in a new Billing period's DRAFT preview,
  finalized it (locked the $45 snapshot), exported CSV (flipped to
  EXPORTED). DISPATCHER was blocked from `/billing` and `/reports` by
  both the route guard and a direct `403` on a `billingPeriods` query —
  rules-level, not just UI.
- **Not built** (deferred until the client names a real system): a live
  QuickBooks/broker-portal API sync. CSV export is the integration
  boundary for now, per the README's adapter architecture — swapping it
  for a real adapter later doesn't require touching this UI.

### Phase 11 — Audit / compliance: PARTIAL (engineering half done)

- Wired the existing (previously unused) `writeAuditLog()` helper into
  every significant mutation: user role/status changes, driver/vehicle/
  trip deletes, inspection approve/flag, payroll approve/delete, billing
  finalize/delete. Best-effort/fail-safe by design — an audit-write
  failure never blocks the real action.
- New `src/pages/audit/AuditPage.tsx` (`/audit`, ADMIN-only in the UI —
  stricter than the rules, which allow any staff role to read, matching
  the existing drivers/vehicles delete-button convention) — searchable
  table of every entry (when, action, actor + role, target, details).
- **Real `firestore.rules` bug found and fixed this session (with your
  go-ahead), same day:** the `auditLogs` create rule's key-whitelist
  check used `request.resource.data.diff(request.resource.data).keys()`
  — `.diff()` returns a `MapDiff`, which has no `.keys()` method (only
  `addedKeys()`/`removedKeys()`/`changedKeys()`/`affectedKeys()`). This
  was the exact line already flagged by a compiler warning on every
  prior deploy, previously assumed harmless ("does not grant extra
  access") — that assumption was wrong and untested, because nothing
  called `writeAuditLog` before this session. In practice it made the
  *entire* create rule always deny: every audit write in the app's
  history had been silently failing. Fixed by checking the document's
  own keys directly (`request.resource.data.keys().hasOnly([...])`)
  instead of a self-diff. Redeployed — **compiler warning is now gone
  entirely** (0 warnings, down from the 1 documented below). Verified
  both directions via isolated REST calls (Commit API with a
  `REQUEST_TIME` server-value transform, so `createdAt` genuinely
  resolves to `request.time` like the app's `serverTimestamp()` does):
  a legitimate whitelisted write now succeeds (`200`), and the same
  write with one extra field is still denied (`403`) — confirms the
  whitelist itself still works, this wasn't a blanket loosening. Also
  re-verified live in the app: finalizing a billing period now produces
  a real entry in the Audit page.
- **Not started:** HIPAA/BAA compliance hardening. The README already
  states this app is not HIPAA certified, by design, for a later phase.
  NEMT trip data is PHI-adjacent (addresses tied to medical
  appointments); real compliance work here is a legal/contractual
  question (a signed BAA with Google Cloud, data retention policy) more
  than an engineering one — flagging back rather than assuming a
  posture, same reasoning as the billing-vendor question.

### Phase 12 — Production deploy: PARTIAL (live; no custom domain)

- Built and deployed to Firebase Hosting on the existing `nemt-hub-dev`
  project: **https://nemt-hub-dev.web.app** — verified live end-to-end
  (sign-in, dashboard, Billing) on the real deployed URL, not just the
  local dev server.
- **Open, needs your/the client's input:** whether `nemt-hub-dev` is the
  actual production project going forward (it currently also holds the
  seeded test org/users) or a separate prod project gets created; a
  custom domain and who controls its DNS (the Maps key's referrer
  allowlist still only has `localhost:5173` — see below); Firestore
  backup policy and budget alerts before calling this "production" for
  real traffic.

### New test accounts this session (nemt-hub-dev)

Added to the same seeded test org (`vDaohHxTqECFmLVGBr4T`) to verify
role boundaries the way Phase 9 did:
- MANAGER: `fingerprintacoustic+nemt-dev-manager@gmail.com`
- DISPATCHER: `fingerprintacoustic+nemt-dev-dispatcher@gmail.com`
- DRIVER: `fingerprintacoustic+nemt-dev-driver@gmail.com` (added 2026-09-17
  to verify the new driver Help tab as a real driver login, not just a
  driver *record* — the earlier "Jordan Rivera" driver still has no
  linked login)

Also seeded one real driver (Jordan Rivera), one vehicle (2026 Toyota
Sienna, TEST123), and one COMPLETED trip with a $45 fare / broker
"BrokerA" (Sep 15, 2026) — this is what Reports/Billing show data for.

### In-app Help & guide (2026-09-17)

Added so the client (or their staff/drivers) don't need to look for
instructions outside the app itself:
- `src/pages/help/HelpPage.tsx` (`/help`, staff app) — sections for
  Getting started, Trips & dispatch, Drivers & vehicles, Inspections,
  Payroll, Billing, Reports, Users, and Audit trail. Each section is
  filtered by the signed-in user's actual role (`hasMinimumRole`), so a
  Dispatcher never sees Payroll/Billing/Audit instructions that don't
  apply to them — verified live as a real DISPATCHER account (saw only
  4 of 9 sections) and a real DRIVER account.
- `src/pages/driver/DriverHelpPage.tsx` (`/driver/help`) — a third tab
  in the driver PWA's bottom nav (Your trips, Navigation, Inspections,
  Your account). `DriverLayout.tsx`'s tab bar is now a 3-column grid
  instead of 2.
- Added "Help" to both nav configs (`src/config/navigation.ts`); no new
  collection, no `firestore.rules` change — purely static, role-aware
  content reusing data already in `AuthContext`.

### Demo prep (2026-09-23)

Prepared for a live client walkthrough of `nemt-hub-dev.web.app`:
- **Dashboard now shows live data** (`DashboardPage.tsx`): active trips
  (with "scheduled today"), vehicles in service, active drivers, open
  issues (flagged inspections + vehicles in maintenance/out of service),
  recent trips, trips-by-status, and real quick-action links. Removed all
  "Phase 2"/"Coming soon" placeholder copy.
- **`scripts/seed-demo-data.mjs --org-id <id>`** — idempotent (`demo-`
  doc ids) fake data: org renamed "Riverside Medical Transport (Demo)",
  the four test logins renamed (Alex Morgan admin, Priya Shah manager,
  Dana Reyes dispatcher, Marcus Bell driver), two extra driver logins
  (`fingerprintacoustic+demo-sofia@gmail.com`,
  `fingerprintacoustic+demo-terrence@gmail.com`, password
  `DemoDriver123!`), 4 drivers (3 linked to logins), 5 vehicles (some with
  telemetry), 11 trips across every status, 3 inspections. Trip times are
  relative to when the script runs, so **re-run it right before a demo**.
  Deliberately writes no audit-log entries.
- **Google Maps key still blocks the live domain** —
  `RefererNotAllowedMapError` confirmed on `https://nemt-hub-dev.web.app`:
  the key's website restrictions only list `localhost:5173`. Address
  "Verify" cannot work live until `https://nemt-hub-dev.web.app/*` is
  added (Google Cloud console → APIs & Services → Credentials → the key →
  Website restrictions). Geocoding now times out after 10s with a clear
  message instead of spinning forever.

## Open decisions / known gaps

- **Google Maps key referrer list is dev-only.** Only `http://localhost:5173/*`
  is on the key's allowed-websites list right now (Phase 4 detail above).
  Add the production domain's referrer once one exists, or geocoding will
  fail there (falls back to nothing — the UI will show a "could not
  verify" error, not manual entry, since the key IS configured).
- **Self-service password reset shipped (2026-09-17).** "Forgot password?"
  on the sign-in screen (`sendPasswordReset()` in `src/services/auth.ts`)
  uses Firebase Auth's own hosted email delivery — no third-party mail
  vendor needed. Confirmation message is identical whether or not the
  email has an account, so it can't be used to enumerate registered
  users. Verified live: a real account got the same generic confirmation
  as a made-up address. `scripts/set-user-password.mjs` remains as a
  dev-only helper for setting a known password on a test account directly
  (bypassing email) when that's more convenient for testing.
- No in-app "invite a new user by email" flow yet — `scripts/create-user.mjs`
  (an Admin SDK script run by an operator) still prints a reset link to
  deliver manually, rather than the app itself sending an invite. Building
  a real in-app invite would need a Cloud Function (browsers can't create
  Auth accounts for someone else) — a bigger, separate feature, not
  bundled into this session's password-reset fix.
- `firestore.rules` now compiles with **0 warnings** (was 1, the
  `auditLogs` `diff(self)`/`.keys()` bug — fixed and verified this
  session, see Phase 11 above).
- **`docs/fix-readme-code-fence` (`2d2b70c`) is now superseded, not
  merged.** That branch's only real payload (closing an unterminated code
  fence in the README) has been cherry-picked directly into `main` along
  with a full pass fixing pervasive em-dash/punctuation corruption found
  throughout `README.md` while looking at that fence (likely from some
  past destructive find-replace — every `—` in the file had been stripped
  to spaces/commas). Merging the branch as-is would have been destructive:
  it was cut before `PROJECT_STATUS.md`, `.firebaserc`, and several
  `.gitignore`/`.env.example` entries existed, so a literal merge would
  have deleted all of that. **Deleted (2026-09-17)** — both the remote
  (`origin/docs/fix-readme-code-fence`) and local copies are gone; nothing
  on it was still needed.
- **`AuthContext.organization` is now loaded (2026-09-17)** — a new
  `src/services/organizations.ts` (`observeOrganization`) subscribes to
  `/organizations/{orgId}` once `userRecord.organizationId` resolves,
  cleared on sign-out. `DashboardPage` now shows the organization's real
  `name` ("Test Org (seed check)") instead of the raw doc id. No rules
  change needed — `organizations/{orgId}` was already readable by same-org
  members.
- **Client confirmed (2026-09-17, user's own words) their trips are real
  Medicaid/Medicare-funded** — moves the HIPAA business-associate question
  from "likely" to the working assumption for this app. Prompted closing
  two of the Compliance Readiness Brief's pure-engineering gaps (neither
  needed a client/legal answer):
  - **Server-side password policy enforced** on `nemt-hub-dev`'s Firebase
    Auth config via `scripts/set-password-policy.mjs` (12+ characters,
    upper/lower/numeric/symbol required, `ENFORCE` mode). This is enforced
    by Google's servers on every sign-up/password-change, not just client
    validation — verified with a direct Admin SDK call that a 12-character
    all-lowercase password is now rejected. `forceUpgradeOnSignin: true`
    means existing weak passwords get a forced reset prompt on next
    sign-in, not an immediate lockout; reset the seeded ADMIN test
    account's password to a compliant one so this session's own access
    wasn't broken by it.
  - **20-minute idle auto-logout** — `AuthContext`'s new
    `IDLE_TIMEOUT_MS`/activity-listener effect signs a user out after 20
    minutes with no mouse/keyboard/scroll/touch activity, and the login
    screen shows "You were signed out after a period of inactivity."
    Verified live by temporarily shortening the timeout to 5 seconds,
    confirming the auto-logout and message, then restoring 20 minutes
    before committing.
  - The **Compliance Readiness Brief artifact was NOT yet updated** to
    move these two items from "open" to "in place" — do that before
    handing it to the client/counsel again.
  - **Still not something engineering can resolve:** the actual BAA
    execution and the business-associate determination itself remain the
    client's (ideally with counsel) to make — this session only closed
    the safeguards that didn't need their answer.
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
- MANAGER `fingerprintacoustic+nemt-dev-manager@gmail.com` and DISPATCHER
  `fingerprintacoustic+nemt-dev-dispatcher@gmail.com` (both ACTIVE, added
  2026-09-16 for Phase 10 verification) — passwords set directly via the
  Admin SDK this session, not recorded here; reset via
  `scripts/set-user-password.mjs` before reusing.
- One driver (Jordan Rivera), one vehicle (2026 Toyota Sienna / TEST123,
  now with a manual telemetry snapshot set), one COMPLETED trip ($45 fare,
  broker "BrokerA", Sep 15 2026).

## Last worked on / next step

- **Last (2026-09-16):** Phases 10–12 built out in one session, all
  deliberately scoped to avoid inventing vendor integrations or financial
  formulas ahead of the client's answers:
  - Phase 10 (Billing/reports) DONE — CSV export + reporting dashboard,
    same derive-don't-invent pattern as Payroll.
  - Phase 11 (Audit/compliance) PARTIAL — audit trail wired end-to-end and
    viewer built; found and fixed (with your go-ahead) a real
    `firestore.rules` bug that had silently blocked every audit-log write
    since the collection was added — see Phase 11 detail above for the
    full root cause and the isolated REST verification (both a legitimate
    write succeeding and a malicious extra-field write still being
    denied).
  - Phase 12 (Production deploy) PARTIAL — app is live at
    **https://nemt-hub-dev.web.app**, verified end-to-end on the real URL.
  - `firestore.rules` compiler warnings: **0** (was 1).
- **Also this session (2026-09-17):**
  - Sent the client a draft message asking which billing system(s) and
    "other software" they use, to unblock a real Phase 10 adapter.
  - Researched the HIPAA/BAA question and published a **Compliance
    Readiness Brief** artifact for the client/counsel — flags Firestore
    and Cloud Storage as BAA-covered, and Firebase Authentication's
    coverage as unconfirmed (a real, previously-unflagged risk since this
    app's identities live there).
  - Phase 8 (Telematics) moved from DEFERRED to **PARTIAL** — manual
    status-entry scaffolding built and verified as a real DISPATCHER
    account; see Phase 8 detail above. No rules change needed.
- **Important context (2026-09-17): the client has not been pitched yet,
  and pricing hasn't been agreed.** Everything above framed as "waiting on
  the client's answer" is really waiting on a client relationship that
  doesn't formally exist yet — nemt-hub-dev is still a demo/prototype
  project, not a live customer deployment. That doesn't block engineering
  work that doesn't need a real client answer (see below), but it does
  mean Phase 10/11/12's remaining vendor-specific/legal items are stuck
  until there's an actual engagement to ask those questions of.
- **Engineering gaps closed this session, since they didn't need a
  client answer:**
  - Self-service password reset (see "Open decisions" above).
  - `AuthContext.organization` now loads the real org record.
  - `docs/fix-readme-code-fence` superseded — its fix (plus a full
    README punctuation-corruption cleanup) landed directly on `main`;
    the stale branch (local and remote) has been deleted.
- **User confirmed (2026-09-17) the client's trips are real
  Medicaid/Medicare-funded** — treat the HIPAA/BAA question as a real,
  not hypothetical, gate going forward. Closed two more engineering-only
  safeguards from the Compliance Readiness Brief in response: a
  server-side password policy (12+ chars, complexity, enforced by
  Firebase's own servers) and a 20-minute idle auto-logout. The
  Compliance Readiness Brief artifact was republished the same day to
  move those two items from "open" (7) to "in place" (8 safeguards, 5
  open, still 2 blocking on the client/legal side).
- **Deleted the superseded `docs/fix-readme-code-fence` branch**
  (2026-09-17, both remote and local) at the user's request — nothing on
  it was still needed once its one real fix landed on `main`.
- **Drafted a pitch deck and pricing proposal** (2026-09-17) for
  pitching the client and agreeing pricing — both use placeholder
  `[Client Name]` (no client identified yet) and "Fingerprint Acoustic"
  as the prepared-by name (the user's business, not yet registered).
  Pricing anchors: $50,000 for what's built today, $85,000 for full
  completion, $2,000/mo recommended ongoing support — the same figures
  discussed earlier in conversation, now presented as an actual
  proposal rather than a range. Same visual identity as the Compliance
  Readiness Brief (Source Serif 4 + IBM Plex Sans, navy/teal) so all
  three read as one package. The deck's "product preview" slide is an
  illustrative mockup, not a real screenshot — a live screenshot capture
  hit a rendering glitch in the browser tool at desktop viewport size,
  not worth chasing further; swap in a real one before presenting if
  wanted.
- **Added in-app Help & guide** (2026-09-17, see Phase detail above) —
  `/help` (staff, role-filtered sections) and `/driver/help` (a third
  driver-app tab), so the client/their team don't need instructions from
  outside the app itself. Verified live as real DISPATCHER and DRIVER
  accounts (new test driver: `fingerprintacoustic+nemt-dev-driver@gmail.com`).
- **Still genuinely stuck on a client relationship existing:**
  - Which billing system(s)/broker portal(s) to build a real adapter for
    (Phase 10) — draft outreach message was written, not yet sent to an
    actual client.
  - The actual BAA execution and business-associate determination — a
    legal/contractual decision only the client (ideally with counsel) can
    make (Phase 11); the brief is ready to hand over once there's an
    engagement.
  - Whether `nemt-hub-dev` becomes the real production Firebase project
    or a separate one gets created, plus a custom domain + DNS owner
    (Phase 12).
  - A real Verizon Connect account, to replace Phase 8's manual entry
    with a live sync; add the eventual production domain to the Maps
    key's referrer allowlist.
  - In-app user-invite-by-email (would need a Cloud Function) — noted
    above as a separate, larger feature from this session's password
    reset work.
