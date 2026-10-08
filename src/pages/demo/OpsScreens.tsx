import { useMemo, useState } from 'react'
import { AlertTriangle, CarFront, ClipboardCheck, MapPin, Plus, Trash2, Users } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { PageHeader } from '../../components/ui/PageHeader'
import { formatDateTime } from '../../lib/format'
import { CLOSED, PLACES, STATUS_TONE, sameDay } from './data'
import { driverName, label, selectClass, vehicleLabel } from './helpers'
import { useDemo } from './store'
import { Table } from './Table'

export function DashboardScreen() {
  const { state } = useDemo()
  const { trips, vehicles, drivers, inspections } = state.data
  const [now] = useState(() => Date.now())
  const stats = useMemo(() => {
    const flagged = inspections.filter((i) => i.status === 'SUBMITTED' && i.autoFlagged).length
    const down = vehicles.filter((v) => v.status === 'MAINTENANCE' || v.status === 'OUT_OF_SERVICE').length
    return {
      active: trips.filter((t) => !CLOSED.includes(t.status)).length,
      today: trips.filter((t) => sameDay(t.pickupAt, now)).length,
      inService: vehicles.filter((v) => v.status === 'AVAILABLE' || v.status === 'ASSIGNED').length,
      drivers: drivers.filter((d) => d.status === 'ACTIVE').length,
      issues: flagged + down,
    }
  }, [trips, vehicles, drivers, inspections, now])

  const cards = [
    { l: 'Active trips', v: stats.active, h: `${stats.today} scheduled today`, i: ClipboardCheck, c: 'bg-blue-50 text-blue-600' },
    { l: 'Vehicles in service', v: stats.inService, h: `${vehicles.length} in the fleet`, i: CarFront, c: 'bg-emerald-50 text-emerald-600' },
    { l: 'Active drivers', v: stats.drivers, h: `${drivers.length} on the roster`, i: Users, c: 'bg-slate-50 text-slate-600' },
    { l: 'Open issues', v: stats.issues, h: 'Brake reports and vehicles down', i: AlertTriangle, c: 'bg-amber-50 text-amber-600' },
  ]
  const recent = [...trips].sort((a, b) => b.pickupAt - a.pickupAt).slice(0, 5)

  return (
    <>
      <PageHeader title="Dashboard" description="A live picture of today's operation." />
      <div className="mt-5 grid grid-cols-2 gap-3">
        {cards.map((c) => (
          <div key={c.l} className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2.5 px-3 py-3">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${c.c}`}>
                <c.i className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold text-slate-900">{c.v}</p>
                <p className="text-xs leading-4 text-slate-500">{c.l}</p>
              </div>
            </div>
            <div className="border-t border-slate-100 px-4 py-1.5 text-[11px] text-slate-400">{c.h}</div>
          </div>
        ))}
      </div>
      <div className="mt-5">
        <Card title="Recent trips" subtitle="Updates as trips move through dispatch">
          <ul className="divide-y divide-slate-100">
            {recent.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-700">
                    {t.from} → {t.to}
                  </p>
                  <p className="text-xs text-slate-400">
                    Pickup {formatDateTime(t.pickupAt)} · {driverName(state.data, t.driverId)}
                  </p>
                </div>
                <Badge tone={STATUS_TONE[t.status]}>{label(t.status)}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}

export function TripsScreen() {
  const { state, dispatch, notify } = useDemo()
  const { data } = state
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState('home1')
  const [to, setTo] = useState('clinic')
  const [hours, setHours] = useState('3')
  const [mobility, setMobility] = useState('Wheelchair')
  const trips = [...data.trips].sort((a, b) => a.pickupAt - b.pickupAt)

  return (
    <>
      <PageHeader
        title="Trips"
        description="Every trip, past and upcoming."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Schedule a trip
          </Button>
        }
      />
      <div className="mt-5">
        <Card title="All trips" subtitle={`${trips.length} trips`}>
          <Table head={['Pickup', 'Route', 'Driver', 'Vehicle', 'Status']}>
            {trips.map((t) => (
              <tr key={t.id}>
                <td className="whitespace-nowrap py-2.5 pr-4 text-slate-700">{formatDateTime(t.pickupAt)}</td>
                <td className="py-2.5 pr-4 text-slate-600">
                  {t.from}
                  <span className="block text-xs text-slate-400">→ {t.to}</span>
                </td>
                <td className="py-2.5 pr-4 text-slate-500">{driverName(data, t.driverId)}</td>
                <td className="py-2.5 pr-4 text-slate-500">{vehicleLabel(data, t.vehicleId)}</td>
                <td className="py-2.5 pr-4">
                  <Badge tone={STATUS_TONE[t.status]}>{label(t.status)}</Badge>
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Schedule a trip"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                dispatch({ type: 'addTrip', from, to, hours: Number(hours), mobility })
                setOpen(false)
                notify('Trip scheduled. Find it on the Dispatch board, ready to assign.')
              }}
            >
              Schedule
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-sm">
          <p className="rounded-lg bg-blue-50 px-3 py-2 text-blue-700">
            In the real app you type any address and press <b>Verify</b>; Google Maps confirms it and saves exact coordinates.
          </p>
          {(
            [
              ['Pickup', from, setFrom],
              ['Drop-off', to, setTo],
            ] as const
          ).map(([l, v, set]) => (
            <label key={l} className="block">
              <span className="mb-1 block font-medium text-slate-700">{l}</span>
              <select value={v} onChange={(e) => set(e.target.value)} className={`w-full ${selectClass}`}>
                {Object.entries(PLACES).map(([k, name]) => (
                  <option key={k} value={k}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="mb-1 block font-medium text-slate-700">Pickup in</span>
              <select value={hours} onChange={(e) => setHours(e.target.value)} className={`w-full ${selectClass}`}>
                <option value="1">1 hour</option>
                <option value="3">3 hours</option>
                <option value="24">Tomorrow</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block font-medium text-slate-700">Mobility need</span>
              <select value={mobility} onChange={(e) => setMobility(e.target.value)} className={`w-full ${selectClass}`}>
                <option>Wheelchair</option>
                <option>Stretcher</option>
                <option>Ambulatory</option>
              </select>
            </label>
          </div>
        </div>
      </Modal>
    </>
  )
}

export function DispatchScreen() {
  const { state, dispatch, notify } = useDemo()
  const { data } = state
  const [picks, setPicks] = useState<Record<string, { d?: string; v?: string }>>({})
  const open = data.trips.filter((t) => !CLOSED.includes(t.status)).sort((a, b) => a.pickupAt - b.pickupAt)
  const drivers = data.drivers.filter((d) => d.hasLogin && d.status === 'ACTIVE')
  const vehicles = data.vehicles.filter((v) => v.status === 'AVAILABLE' || v.status === 'ASSIGNED')

  return (
    <>
      <PageHeader title="Dispatch board" description="Trips that are not finished yet, soonest first." />
      <div className="mt-5">
        <Card title="Open trips" subtitle={`${open.length} to run or assign`}>
          <div className="divide-y divide-slate-100">
            {open.map((t) => {
              const pick = picks[t.id] ?? {}
              const unassigned = !t.driverId
              return (
                <div key={t.id} className="flex flex-col gap-3 py-3 lg:flex-row lg:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-700">
                      {t.from} → {t.to}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatDateTime(t.pickupAt)} · {t.mobility}
                    </p>
                  </div>
                  <Badge tone={STATUS_TONE[t.status]}>{label(t.status)}</Badge>
                  {unassigned ? (
                    <div className="flex flex-wrap items-center gap-2" data-testid={`assign-${t.id}`}>
                      <select
                        aria-label="Driver"
                        className={selectClass}
                        value={pick.d ?? ''}
                        onChange={(e) => setPicks({ ...picks, [t.id]: { ...pick, d: e.target.value } })}
                      >
                        <option value="">Driver…</option>
                        {drivers.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                      <select
                        aria-label="Vehicle"
                        className={selectClass}
                        value={pick.v ?? ''}
                        onChange={(e) => setPicks({ ...picks, [t.id]: { ...pick, v: e.target.value } })}
                      >
                        <option value="">Vehicle…</option>
                        {vehicles.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.label.replace(/^\d{4} /, '')}
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        disabled={!pick.d || !pick.v}
                        onClick={() => {
                          dispatch({ type: 'assignTrip', tripId: t.id, driverId: pick.d!, vehicleId: pick.v! })
                          notify(`Assigned to ${driverName(data, pick.d)}. Switch to the Driver role to see it on their phone.`)
                        }}
                      >
                        Assign
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 lg:w-56">
                      {driverName(data, t.driverId)}
                      <span className="block text-slate-400">{vehicleLabel(data, t.vehicleId)}</span>
                    </p>
                  )}
                </div>
              )
            })}
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Helen Park isn&rsquo;t in the driver list: she&rsquo;s on leave and has no login yet.
          </p>
        </Card>
      </div>
    </>
  )
}

export function VehiclesScreen() {
  const { state, dispatch, notify } = useDemo()
  const { data, role } = state
  const [edit, setEdit] = useState<string | null>(null)
  const [where, setWhere] = useState('home1')
  const [speed, setSpeed] = useState('0')
  const [ign, setIgn] = useState(true)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)

  return (
    <>
      <PageHeader title="Vehicles" description="The fleet, with each vehicle's last known status." />
      <div className="mt-5">
        <Card title="Fleet" subtitle={`${data.vehicles.length} vehicles`}>
          <Table head={['Vehicle', 'Plate', 'Last known status', 'Status', 'Actions']}>
            {data.vehicles.map((v) => (
              <tr key={v.id}>
                <td className="py-2.5 pr-4 font-medium text-slate-800">
                  {v.label}
                  {v.wheelchair && (
                    <Badge tone="blue" className="ml-2">
                      WC
                    </Badge>
                  )}
                </td>
                <td className="py-2.5 pr-4 text-slate-500">{v.plate}</td>
                <td className="py-2.5 pr-4 text-xs">
                  {v.where ? (
                    <div className="space-y-0.5">
                      <Badge tone={v.ignitionOn ? 'green' : 'neutral'}>{v.ignitionOn ? 'Ignition on' : 'Ignition off'}</Badge>
                      <p className="text-slate-500">
                        {v.speedMph} mph · {v.where}
                      </p>
                      <p className="text-slate-400">as of {formatDateTime(v.recordedAt)}</p>
                    </div>
                  ) : (
                    <span className="text-slate-400">No status yet</span>
                  )}
                </td>
                <td className="py-2.5 pr-4">
                  <select
                    aria-label="Vehicle status"
                    className={selectClass}
                    value={v.status}
                    onChange={(e) => {
                      dispatch({ type: 'setVehicleStatus', id: v.id, status: e.target.value as typeof v.status })
                      notify('Vehicle status updated.')
                    }}
                  >
                    {['AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'OUT_OF_SERVICE'].map((s) => (
                      <option key={s} value={s}>
                        {label(s)}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2.5 pr-4">
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setEdit(v.id)}>
                      <MapPin className="h-4 w-4" aria-hidden="true" />
                      Update status
                    </Button>
                    {role === 'ADMIN' &&
                      (confirmDel === v.id ? (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => {
                            dispatch({ type: 'deleteVehicle', id: v.id })
                            setConfirmDel(null)
                            notify('Vehicle deleted, and the deletion was written to the audit trail.')
                          }}
                        >
                          Confirm
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" aria-label="Delete vehicle" onClick={() => setConfirmDel(v.id)}>
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      ))}
                  </div>
                </td>
              </tr>
            ))}
          </Table>
          {role !== 'ADMIN' && <p className="mt-3 text-xs text-slate-400">Only an Admin sees the delete button.</p>}
        </Card>
      </div>

      <Modal
        open={edit !== null}
        onClose={() => setEdit(null)}
        title="Update vehicle status"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEdit(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                dispatch({ type: 'updateLocation', id: edit!, where: PLACES[where], speedMph: Number(speed) || 0, ignitionOn: ign })
                setEdit(null)
                notify('Last known status saved.')
              }}
            >
              Save status
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-sm">
          <p className="text-slate-500">
            Entered by hand for now (for example what a driver says over the phone). When a telematics provider is connected, this fills in automatically.
          </p>
          <label className="block">
            <span className="mb-1 block font-medium text-slate-700">Current location</span>
            <select value={where} onChange={(e) => setWhere(e.target.value)} className={`w-full ${selectClass}`}>
              {Object.entries(PLACES).map(([k, name]) => (
                <option key={k} value={k}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block font-medium text-slate-700">Speed (mph)</span>
            <input type="number" value={speed} onChange={(e) => setSpeed(e.target.value)} className={`w-full ${selectClass}`} />
          </label>
          <label className="flex items-center gap-2 font-medium text-slate-700">
            <input type="checkbox" checked={ign} onChange={(e) => setIgn(e.target.checked)} className="h-4 w-4" />
            Ignition on
          </label>
        </div>
      </Modal>
    </>
  )
}

export function DriversScreen() {
  const { state } = useDemo()
  const { data } = state
  return (
    <>
      <PageHeader title="Drivers" description="The roster, licenses and who can use the driver app." />
      <div className="mt-5">
        <Card title="Roster" subtitle={`${data.drivers.length} drivers`}>
          <Table head={['Name', 'Phone', 'License', 'App login', 'Status']}>
            {data.drivers.map((d) => (
              <tr key={d.id}>
                <td className="py-2.5 pr-4 font-medium text-slate-800">{d.name}</td>
                <td className="py-2.5 pr-4 text-slate-500">{d.phone}</td>
                <td className="py-2.5 pr-4 text-slate-500">{d.license}</td>
                <td className="py-2.5 pr-4">{d.hasLogin ? <Badge tone="green">Linked</Badge> : <Badge tone="neutral">None yet</Badge>}</td>
                <td className="py-2.5 pr-4">
                  <Badge tone={d.status === 'ACTIVE' ? 'green' : 'amber'}>{label(d.status)}</Badge>
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </>
  )
}

export function InspectionsScreen() {
  const { state, dispatch, notify } = useDemo()
  const { data } = state
  return (
    <>
      <PageHeader title="Inspections" description="Pre- and post-trip vehicle checks submitted by drivers." />
      <div className="mt-5 space-y-3">
        {data.inspections.map((i) => (
          <Card key={i.id}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800">
                  {vehicleLabel(data, i.vehicleId)} · {label(i.type)}
                </p>
                <p className="text-xs text-slate-400">
                  {driverName(data, i.driverId)} · {formatDateTime(i.at)}
                </p>
                {i.note && <p className="mt-1 text-sm text-amber-700">{i.note}</p>}
              </div>
              {i.autoFlagged && <Badge tone="amber">Auto-flagged</Badge>}
              <Badge tone={i.status === 'APPROVED' ? 'green' : i.status === 'FLAGGED' ? 'red' : 'blue'}>{i.status}</Badge>
              {i.status === 'SUBMITTED' && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      dispatch({ type: 'reviewInspection', id: i.id, status: 'APPROVED' })
                      notify('Approved, and logged in the audit trail.')
                    }}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      dispatch({ type: 'reviewInspection', id: i.id, status: 'FLAGGED' })
                      notify('Flagged, and logged in the audit trail.')
                    }}
                  >
                    Flag
                  </Button>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </>
  )
}
