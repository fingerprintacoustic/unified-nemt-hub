# Unified NEMT Operations Hub

Production foundation for a **Non-Emergency Medical Transportation (NEMT)** operations platform: scheduling, dispatch, fleet management, driver workflows (PWA), inspections, payroll, billing, reports, and integrations   built as a single React + TypeScript codebase with Firebase (Auth, Firestore, Storage) backend



> **Phase status**: Foundation. Placeholder pages exist for every module No external vendor integrations yet Not HIPAA certified   designed so compliance hardening can be added in a later phase



## Technology stack

- **React 19** + **TypeScript** (strict, throughout)
- **Vite 8**   dev server, production build
- **Tailwind CSS v4**   utility-first styling
- **Firebase**   Authentication (email/password, Cloud Firestore (data, Cloud Storage (inspection media, Cloud Functions (reserved for Phase 2, Hosting (via `firebase.json`))
- **react-router-dom v7**   routing (staff app + `/driver` PWA tree,
- **lucide-react**   icons



## Local development setup

```bash
npm install
npm run dev
```

The app boots without Firebase configured (shows local preview mode,. Copy `.env.example` to `.env` and fill real values when ready



### Firebase emulators (optional)

```bash
# in one terminal
firebase emulators:start
# in another
VITE_FIREBASE_EMULATORS=true npm run dev
```

Emulator ports: Auth `9099`, Firestore `8080`, Storage `9199`



## Firebase setup

1. Create a Firebase project at <https://console.firebase.google.com>
2. Enable **Authentication**  Sign-in method **Email/Password**
3. Enable **Cloud Firestore** and **Cloud Storage**; deploy the rules (below,
4. Register a web app; copy the config into `.env`
5. (Later phase, Enable **Cloud Functions** and **Hosting**



```bash
# deploy rules
npx firebase deploy --only firestore:rules,storage
```

Security rules live in:

- `firestore.rules`   org-scoped role-based access (`organizationId` checks, staff/driver role gates,
- `storage.rules`   org/UID-scoped photo/video uploads
- `firestore.indexes.json`   composite index declarations
- `firebase.json`   hosting/firestore/storage config with SPA rewrite



> Frontend role gating is UX-only; **Firestoreand Storage rules enforce authorization server-side** Do not rely on the client alone



## Environment variables

Copy `.env.example`  `.env`:

| Variable | Purpose |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | Firebase web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Auth domain (e.g., `your-app.firebaseapp.com`) |
| `VITE_FIREBASE_PROJECT_ID` | Project identifier |
| `VITE_FIREBASE_STORAGE_BUCKET` | Default storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | FCM sender ID |
| `VITE_FIREBASE_APP_ID` | Web app ID |
| `VITE_FIREBASE_MEASUREMENT_ID` | Analytics measurement ID (optional) |
| `VITE_FIREBASE_EMULATORS` | `true` to connect to local emulators |

**Never commit `.env`.** It is git-ignored.



## Running the application

```bash
npm run dev        # local dev at http://localhost:5173
npm run build      # type-check + production build  dist/
npm run preview     # serve the production build locally
npm run lint        # oxlint
```

## Building the application

`npm run build` runs `tsc -b && vite build` The output lands in `dist/` If your bundle exceeds the 500 kB warning threshold, code-split heavy routes (e.g., dynamic `import()` for module pages, in a later phase



## Deployment instructions

```bash
npm run build
npx firebase deploy --only hosting    # static app
npx firebase deploy                     # all (hosting, firestore:rules,storage:rules,
```

`firebase.json` includes an SPA rewrite so all routes serve `index.html`



## Project structure

```text
src/
  components/
    auth/        ProtectedRoute (role gating,
    layout/      AppLayout, Sidebar, Header (staff app;; DriverLayout (driver PWA,
    ui/          Button, Card, Badge, EmptyState, PageHeader, FullScreenLoader
  config/        env (typed vars, roles (role hierarchy, navigation (role-aware nav,
  context/      AuthContext (auth state, user record, org placeholder,
  lib/          firebase (app/auth/firestore/storage getters + emulator wiring, format utils,
  pages/         One dir per module (dashboard, drivers, vehicles, trips, dispatch, inspections, payroll, billing, reports, integrations, settings, driver/, auth/, NotFound,
  router/       Route table (staff app + driver PWA,
  services/     auth, users, audit, storage (Firebase service layer,
  types/        Domain models + Firestore collection shape
public/           PWA assets (manifest.webmanifest, sw.js, icons,
firestore.rules   Firestore security rules (role-validated, org-scoped,
storage.rules      Storage security rules (org/UID-scoped media,
firestore.indexes.json, firebase.json   Firebase infrastructure config



## Authentication and roles

- Auth via Firebase **Email/Password**; user docs live n `users/{uid}` with `organizationId`, `role`, `status`
- Roles (ranked hierarchy,:
   - `ADMIN`   full access, integrations, settings
   - `MANAGER`   payroll, billing, reports
   - `DISPATCHER`   dispatch, drivers, vehicles, trips, inspections
   - `DRIVER`   driver PWA (`/driver`): own trips + inspections
- Frontend gates in `ProtectedRoute` (`minRole`, `staffApp`, `driverApp`,and `navItemsFor`;; server-side rules n `firestore.rules`/`storage.rules` are authoritative Administer roles via Firestore (seed a user doc manually during setup until an admin UI ships in a later phase,



## Current development phase

**Foundation (Phase 1,**   complete:

- Responsive web app shell + driver PWA shell (shared codebase
- Auth foundation + role-based routing/gating
- Initial data models (users, drivers, vehicles, trips, inspections, organizations, locations, auditLogs,   all `organizationId`-scoped,
- Firebase wiring (Auth, Firestore, Storage, emulator support, rules, indexes,
- Secure storage-service foundation for inspection photo/video uploads (org-scoped paths, 15 MB cap,
- Pre/post-trip inspection data model (driver confirmation, GPS, odometer, condition, damage notes, media, audit,
- Dashboard shell (role-aware nav, placeholder cards, recent-activity + system-status placeholders,
- Module placeholder pages for: drivers, vehicles, trips, dispatch, inspections, payroll, billing, reports, integrations, settings
- Integration Center placeholder (vendor-agnostic module surface,
- README, HANDOFF (build-state notes for AI collaborators, commit hygiene + git-ignored env files

**Not in this phase**: real CRUD, trip dispatch workflow, inspections workflow UI, payroll/billing/reports logic, vendor integrations, Cloud Functions, PWA offline sync, admin user management, HIPAA hardening   all arrive in later phases (Phase 2+, module by module, each behind an approved design



## Future integration architecture

The Integration Center (`/integrations`) is designed to keep vendor concerns modular:

- **Vendor adapters**: each third-party system (Verizon GPS, camera systems, payroll providers, billing systems, mapping/navigation, NEMT brokers, others, gets an adapter module behind a stable internal interface   swapping a vendor replaces only its adapter, not the app
- **Outbox/event pattern (planned,: domain events (trip created, inspection submitted, feed an outbox collection so integrations replay without coupling the core transaction path, ideal for Firestore-triggered Cloud Functions
- **Org-level separation**: every integration config document is scoped to `organizationId`, never shared across orgs
  
No external provider is connected during this phase



## Contributing

Keep the foundation buildable at every stage: `npm run build` must stay green See `HANDOFF.md` for build-state notes maintained for AI collaborators (OpenHands, Claude, ChatGPT,