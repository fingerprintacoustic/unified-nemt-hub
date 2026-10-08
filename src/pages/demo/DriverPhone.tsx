import { useState } from 'react'
import { Ambulance, Camera, ClipboardCheck, HelpCircle, Navigation } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { formatDateTime } from '../../lib/format'
import { CLOSED, NEXT_STATUS, STATUS_TONE } from './data'
import { label, selectClass, vehicleLabel } from './helpers'
import { useDemo } from './store'

const ME = 'd1'

export function DriverPhone({ page, onPage }: { page: string; onPage: (p: string) => void }) {
  const tabs = [
    { id: 'trips', name: 'My Trips', icon: ClipboardCheck },
    { id: 'inspect', name: 'Inspections', icon: Camera },
    { id: 'help', name: 'Help', icon: HelpCircle },
  ]
  return (
    <div className="mx-auto w-full max-w-[380px] rounded-[2.2rem] border-[10px] border-slate-900 bg-slate-100 shadow-xl">
      <div className="flex h-12 items-center gap-2.5 rounded-t-[1.5rem] bg-slate-900 px-4 text-white">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
          <Ambulance className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <p className="text-xs font-bold leading-tight">NEMT Driver</p>
          <p className="text-[9px] uppercase tracking-wider text-slate-400">Marcus Bell</p>
        </div>
      </div>
      <div className="h-[520px] overflow-y-auto px-3 py-3">
        {page === 'inspect' ? <Inspect /> : page === 'help' ? <Help /> : <Trips />}
      </div>
      <nav className="grid grid-cols-3 gap-1 rounded-b-[1.5rem] border-t border-slate-200 bg-white p-1.5" aria-label="Driver navigation">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onPage(t.id)}
            className={`flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium ${
              page === t.id ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <t.icon className="h-4 w-4" aria-hidden="true" />
            {t.name}
          </button>
        ))}
      </nav>
    </div>
  )
}

function Trips() {
  const { state, dispatch, mark, notify } = useDemo()
  const { data } = state
  const mine = data.trips.filter((t) => t.driverId === ME).sort((a, b) => a.pickupAt - b.pickupAt)
  const active = mine.filter((t) => !CLOSED.includes(t.status))
  const history = mine.filter((t) => CLOSED.includes(t.status))

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-base font-bold text-slate-900">My Trips</h3>
        <p className="text-xs text-slate-500">Trips assigned to you</p>
      </div>
      {active.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-xs text-slate-500">
          No trips right now. Switch to <b>Dispatcher</b>, assign a trip to Marcus Bell, then come back.
        </p>
      )}
      {active.map((t) => {
        const next = NEXT_STATUS[t.status]
        const toDropoff = t.status === 'PICKED_UP' || t.status === 'DROPPED_OFF'
        return (
          <div key={t.id} className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-500">{formatDateTime(t.pickupAt)}</p>
              <Badge tone={STATUS_TONE[t.status]}>{label(t.status)}</Badge>
            </div>
            <p className="text-sm font-medium text-slate-800">{t.from}</p>
            <p className="text-xs text-slate-500">→ {t.to}</p>
            <p className="text-[11px] text-slate-400">
              {t.mobility} · {vehicleLabel(data, t.vehicleId)}
            </p>
            {next && next.to !== 'ASSIGNED' && (
              <Button className="w-full" size="lg" onClick={() => dispatch({ type: 'setTripStatus', tripId: t.id, status: next.to })}>
                {next.label}
              </Button>
            )}
            {t.status !== 'DROPPED_OFF' && (
              <button
                type="button"
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50"
                onClick={() => {
                  mark('navigated')
                  notify(`On a real phone this opens Google Maps with directions to the ${toDropoff ? 'drop-off' : 'pickup'}.`)
                }}
              >
                <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
                Navigate to {toDropoff ? 'drop-off' : 'pickup'}
              </button>
            )}
          </div>
        )
      })}
      {history.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Earlier today</p>
          <ul className="space-y-1.5">
            {history.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-xs text-slate-600">
                <span className="truncate">
                  {t.from} → {t.to}
                </span>
                <Badge tone={STATUS_TONE[t.status]}>{label(t.status)}</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function Inspect() {
  const { state, dispatch, notify } = useDemo()
  const [vehicleId, setVehicleId] = useState('v1')
  const [kind, setKind] = useState<'PRE_TRIP' | 'POST_TRIP'>('PRE_TRIP')
  const [brakes, setBrakes] = useState('GOOD')
  const [note, setNote] = useState('')
  const [ok, setOk] = useState(false)

  return (
    <div className="space-y-3 text-sm">
      <div>
        <h3 className="text-base font-bold text-slate-900">Vehicle inspection</h3>
        <p className="text-xs text-slate-500">Pre-trip or post-trip check</p>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-700">Vehicle</span>
        <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className={`w-full ${selectClass}`}>
          {state.data.vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-700">Type</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className={`w-full ${selectClass}`}>
            <option value="PRE_TRIP">Pre-trip</option>
            <option value="POST_TRIP">Post-trip</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-700">Brakes</span>
          <select value={brakes} onChange={(e) => setBrakes(e.target.value)} className={`w-full ${selectClass}`}>
            <option value="GOOD">Good</option>
            <option value="POOR">Poor</option>
          </select>
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-700">Damage or notes</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          placeholder="Optional"
        />
      </label>
      <p className="text-[11px] text-slate-400">The real app also captures photos, video, odometer and GPS. A poor rating flags it automatically.</p>
      <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
        <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} className="h-4 w-4" />I confirm this inspection is accurate
      </label>
      <Button
        className="w-full"
        disabled={!ok}
        onClick={() => {
          dispatch({ type: 'submitInspection', vehicleId, kind, brakesPoor: brakes === 'POOR', note })
          setNote('')
          setOk(false)
          notify('Submitted. Switch to Dispatcher and open Inspections to review it.')
        }}
      >
        Submit inspection
      </Button>
    </div>
  )
}

function Help() {
  const items = [
    ['Your trips', 'Tap the big button on a trip to move it to the next stage: Start, Picked up, Dropped off, Completed.'],
    ['Navigation', 'Tap Navigate to open directions in your phone’s maps app.'],
    ['Inspections', 'Submit a pre-trip or post-trip check any time from the Inspections tab.'],
    ['Your account', 'Forgot your password? Use "Forgot password?" on the sign-in screen.'],
  ]
  return (
    <div className="space-y-2.5">
      <h3 className="text-base font-bold text-slate-900">Help</h3>
      {items.map(([t, b]) => (
        <div key={t} className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-sm font-semibold text-slate-800">{t}</p>
          <p className="text-xs leading-5 text-slate-600">{b}</p>
        </div>
      ))}
    </div>
  )
}
