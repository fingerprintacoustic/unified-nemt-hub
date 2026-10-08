import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Check, Lock, RotateCcw, X } from 'lucide-react'
import { MAIN_NAV, navItemsFor } from '../../config/navigation'
import type { UserRole } from '../../types'
import { DriverPhone } from './DriverPhone'
import { PERSONAS } from './data'
import { FLOW, GUIDES } from './guides'
import { SCREENS } from './screensMap'
import { DemoContext, useDemo, useDemoStore } from './store'

const ROLE_PARAM: Record<string, UserRole> = {
  dispatcher: 'DISPATCHER',
  manager: 'MANAGER',
  admin: 'ADMIN',
  driver: 'DRIVER',
}

export function DemoPage() {
  const store = useDemoStore()
  return (
    <DemoContext.Provider value={store}>
      <DemoShell />
    </DemoContext.Provider>
  )
}

function DemoShell() {
  const { state, dispatch, mark, toast } = useDemo()
  const [params, setParams] = useSearchParams()
  const role = ROLE_PARAM[params.get('role') ?? ''] ?? 'DISPATCHER'
  const isDriver = role === 'DRIVER'
  const [nav, setNav] = useState<{ role: UserRole; page: string }>({ role, page: isDriver ? 'trips' : 'dashboard' })
  // Changing role always starts on that role's home screen.
  const page = nav.role === role ? nav.page : isDriver ? 'trips' : 'dashboard'
  const setPage = (p: string) => setNav({ role, page: p })

  useEffect(() => {
    dispatch({ type: 'setRole', role })
  }, [role, dispatch])

  useEffect(() => {
    mark(`visited:${page}`)
  }, [page, role, mark])

  const guide = GUIDES.find((g) => g.role === role)!
  const persona = PERSONAS[role]
  const trackable = guide.steps.filter((s) => s.key)
  const doneCount = trackable.filter((s) => state.done[s.key!]).length
  const firstOpen = guide.steps.findIndex((s) => s.key && !state.done[s.key])
  const finished = trackable.length > 0 && doneCount === trackable.length
  const nextGuide = GUIDES[(GUIDES.findIndex((g) => g.role === role) + 1) % GUIDES.length]

  const chooseRole = (r: UserRole) => setParams({ role: r.toLowerCase() })

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-2 bg-slate-900 px-4 py-2 text-sm text-white">
        <p>
          <b>Interactive demo</b> <span className="text-slate-300">· sample data only, nothing is saved or sent anywhere</span>
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => dispatch({ type: 'reset' })}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-semibold hover:bg-slate-600"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Restart demo
          </button>
          <Link to="/login" className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold hover:bg-blue-500">
            Sign in
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">Unified NEMT Operations Hub</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">See how it works, hands-on</h1>
        <p className="mt-3 max-w-3xl text-base text-slate-600">
          One platform for non-emergency medical transport: scheduling, dispatch, a driver phone app, inspections, payroll, billing and an
          audit trail. Pick a role below and follow its checklist. Everything here is live: what one role does shows up for the others.
          No sign-in, no setup.
        </p>

        <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {FLOW.map((f, i) => (
            <li key={f.what} className="rounded-xl border border-slate-200 bg-white p-4">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">{i + 1}</span>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-blue-600">{f.who}</p>
              <p className="mt-1 text-sm text-slate-700">{f.what}</p>
            </li>
          ))}
        </ol>

        <h2 className="mt-10 text-lg font-bold">1. Choose who you want to be</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {GUIDES.map((g) => (
            <button
              key={g.role}
              type="button"
              onClick={() => chooseRole(g.role)}
              aria-pressed={g.role === role}
              className={`rounded-xl border bg-white p-4 text-left transition ${
                g.role === role ? 'border-blue-600 ring-2 ring-blue-600' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <p className="text-base font-bold">{g.label}</p>
              <p className="text-xs text-slate-500">{PERSONAS[g.role].name}</p>
              <p className="mt-2 text-sm text-slate-600">{g.who}</p>
              <ul className="mt-3 space-y-1 text-xs text-slate-600">
                {g.canDo.map((c) => (
                  <li key={c} className="flex gap-1.5">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                    {c}
                  </li>
                ))}
                {g.cannotDo.map((c) => (
                  <li key={c} className="flex gap-1.5 text-slate-400">
                    <X className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {c}
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </div>

        <h2 className="mt-10 text-lg font-bold">2. Follow the checklist and click around</h2>
        <div className="mt-3 grid gap-6 lg:grid-cols-[340px_1fr]">
          <aside className="self-start rounded-xl border border-slate-200 bg-white p-5 lg:sticky lg:top-14">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {persona.name} · {persona.title}
            </p>
            <p className="mt-1 text-sm text-slate-600">{guide.intro}</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={doneCount} aria-valuemax={trackable.length}>
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(doneCount / trackable.length) * 100}%` }} />
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {doneCount} of {trackable.length} done
            </p>
            <ol className="mt-4 space-y-4">
              {guide.steps.map((s, i) => {
                const done = s.key ? state.done[s.key] : false
                const current = i === firstOpen
                return (
                  <li key={s.title} className={`flex gap-3 ${current ? '' : done ? 'opacity-70' : ''}`}>
                    <span
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        done ? 'bg-emerald-500 text-white' : s.key ? (current ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600') : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : s.key ? i + 1 : 'i'}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{s.title}</p>
                      <p className="mt-0.5 text-xs leading-5 text-slate-600">{s.body}</p>
                      {s.page && !done && (
                        <button
                          type="button"
                          onClick={() => setPage(s.page!)}
                          className="mt-1.5 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                        >
                          Take me there
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
            {finished && (
              <div className="mt-5 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
                <p className="font-semibold">That is the {guide.label} tour done.</p>
                <button type="button" onClick={() => chooseRole(nextGuide.role)} className="mt-1 font-semibold underline">
                  Try {nextGuide.label} next
                </button>
              </div>
            )}
          </aside>

          <section aria-label={`${guide.label} view of the app`} className="min-w-0">
            {isDriver ? (
              <>
                <p className="mb-3 text-center text-xs text-slate-500">This is the driver&rsquo;s phone. Tap the buttons: it is working.</p>
                <DriverPhone page={page} onPage={setPage} />
              </>
            ) : (
              <StaffFrame role={role} page={page} onPage={setPage} />
            )}
          </section>
        </div>

        <p className="mt-12 border-t border-slate-200 pt-6 text-center text-sm text-slate-500">
          Fingerprint Acoustic · Unified NEMT Operations Hub. Everything in this demo is made-up sample data.
        </p>
      </main>

      {toast && (
        <div role="status" className="fixed inset-x-0 bottom-6 z-50 mx-auto w-fit max-w-[90vw] rounded-lg bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}

function StaffFrame({ role, page, onPage }: { role: UserRole; page: string; onPage: (p: string) => void }) {
  const { state } = useDemo()
  const allowed = useMemo(() => navItemsFor(role), [role])
  const allowedIds = new Set(allowed.map((n) => n.href.slice(1)))
  const Screen = SCREENS[allowedIds.has(page) ? page : 'dashboard']

  return (
    <div className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-xl">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-100 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        <span className="ml-2 truncate text-xs text-slate-500">Unified NEMT Operations Hub · signed in as {PERSONAS[state.role].name}</span>
      </div>
      <div className="flex flex-col md:flex-row">
        <nav className="flex shrink-0 gap-1 overflow-x-auto bg-slate-900 p-2 md:w-48 md:flex-col md:overflow-visible" aria-label="App menu">
          {MAIN_NAV.map((item) => {
            const id = item.href.slice(1)
            const ok = allowedIds.has(id)
            const Icon = item.icon
            return ok ? (
              <button
                key={id}
                type="button"
                onClick={() => onPage(id)}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium ${
                  page === id ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {item.label}
              </button>
            ) : (
              <span
                key={id}
                title="Not available for this role"
                className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600"
              >
                <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
                {item.label}
              </span>
            )
          })}
        </nav>
        <div className="max-h-[78vh] min-h-[460px] min-w-0 flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6">{Screen && <Screen />}</div>
      </div>
    </div>
  )
}
