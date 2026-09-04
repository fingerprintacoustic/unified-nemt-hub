# NEMT Hub — Build Handoff

> Parity file for agents (OpenHands, Claude, ChatGPT) continuing this project.
> Read this first. It explains where the build stands, what broke, and how to fix it fast.

## Who is building this

This project is being built collaboratively by multiple AI assistants:

- **OpenHands** — current worker. Established repo, scaffolded pages/PWA/Firebase models, and is fixing the build.
- **Claude** — may continue from this handoff. See "Current state" below..
- **ChatGPT** — also part of the build team. Same notes apply..

If you make significant progress or decisions, append to this file and keep it current.

## Project

- Repo: `https://github.com/fingerprintacoustic/unified-nemt-hub`
- Stack: React 19 + TypeScript + Vite, Tailwind CSS v4, Firebase (Auth, Firestore, Storage), react-router-dom v7, lucide-react.
 Firebase config optional at build time (runs locally with no `.env`).

## Validated facts (learned the hard way)

1. **The scaffolding files suffered systemic character corruption** — widespread missing closing parens/braces, and "`?`" style mangling in *some* files, not all。
   Examples seen: `useState(false` (missing `)`)、`interface Foo {` sometimes mangled to `inter-face Foo {`-style issues, `tone: 'amber'` vs `tone:: 'amber'`, `: string` vs `: string`, inline `{ x: 1 }` becoming `{ x: 1 ` etc。
2. **tsc --noEmit (local `./node_modules/.bin/tsc`) currently reports zero errors.** The authoritative check is `npm run build` (`tsc -b && vite build`) — **it still fails** on a subset of files。
3. **`npm run build` error list (2026-09-03)**, 14 errors across:
   - `src/components/layout/AppLayout.tsx:11` — parse issue caused by `useState(false` missing `)` on line 9
   - `src/components/layout/DriverLayout.tsx:37` (`initialsFrom(displayName}` and `:57`
   - `src/components/layout/Header.tsx:65` — same `initialsFrom(displayName}` pattern
   - `src/pages/dashboard/DashboardPage.tsx` — `role` line 38, `tone:: 'amber'` (double colon) line 44, type literal line 47, extra `}` line 143
   - `src/pages/trips/TripsPage.tsx` lines 3/9 — missing `}` balance
   - `src/services/storage.ts` lines 25/66 — unterminated string/template literal (`sanitizeFileName` end, and final `}`)
4. **Firebase foundation code is present**: `src/types/index.ts` (domain models,, `src/lib/firebase.ts` (emulator wiring,, `src/services/*` (auth, users, audit, storage,, `src/config/roles.ts`, `src/config/navigation.ts`, `src/context/AuthContext.tsx`, `src/components/auth/ProtectedRoute.tsx`。
5. **All module pages exist** under `src/pages/` (dashboard, drivers, vehicles, trips, dispatch, inspections, payroll, billing, reports, settings, integrations, driver home/inspections, NotFound)。`AppLayout`/`DriverLayout`/`Sidebar`/`Header` exist。。 PWA assets exist in `public/` (manifest.webmanifest, sw.js, icons)。
6. **No commits yet.** `git status` will show untracked everything; repo has only `master` (no commits initial state after `git init`)。 Plan is 6-8 logical commits (Initialize platform → Firebase foundation → Auth/roles → App shell → Data models → Module placeholders → Build fixes → README/docs)。 Push branch (NOT main) unless told otherwise。



## Current task (where OpenHands stands)

OpenHands was mid-fixing the 14 build errors above when it produced this handoff。 Next steps in priority order:

:

1. Fix the remaining build errors (list above,, aka the "Validation notes"我
2. `npm run build` until it exits 0。
3. `npm run dev` / `vite preview` and verify routes render, no console errors。
4. Verify `public/manifest.webmanifest` + `public/sw.js` wired in `index.html`。
5. Create `.env.example` from `src/config/env.ts` keys (VITE_FIREBASE_*,**never** commit real secrets)。
6. Write `README.md` (overview, stack, local dev, Firebase setup, env vars, run/build/deploy, structure, auth/roles, current phase, future integrations)。
7. Commit in planned logical steps, push to `fingerprintacoustic/unified-nemt-hub` on a working branch, then optionally open PR唱。
8. Update this file or add final summary to user (what created, what works, placeholders, config needed, problems, commit hashes)。

## Known-good conventions (respect these)

- TypeScript throughout; UI/business-logic/Firebase-service/types/utilities separated (see `src/` tree)。
- Authorization: role model `ADMIN > MANAGER > DISPATCHER > DRIVER` (`src/config/roles.ts`); UI gates in `ProtectedRoute` + `navItemsFor`, server rules authoritative (rules/ folder to be built in production-hardening phase)。
- Firebase config optional: `src/config/env.ts` `hasFirebaseConfig()` → app boots "unconfigured" offline; `.env.example` documents vars。
- Data model docs: `src/types/index.ts` — users, drivers, vehicles, trips, inspections, organizations, locations, auditLogs (all scoped by `organizationId`)。
- Driver PWA: `DriverLayout` bottom tabs; mobile-first; separate `/driver` tree in router。
- Emulators via `VITE_FIREBASE_EMULATORS=true` → auth 9099, firestore 8080, storage 9199。。



## Output hygiene for AI collaborators

- This repo's files **may be corrupted when written through some agent file tools**:always run the authoritative check after edits:
  **`cd /workspace/project && npm run build`**。
- Prefer
  - `file_editor` for surgical single-line fixes, then re-run build。
;
- Do NOT commit real secrets; keep `.env*` out of git。
- Do NOT create duplicate files/folders;edit in place。