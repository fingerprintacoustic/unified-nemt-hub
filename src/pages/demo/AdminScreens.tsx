import { BarChart3, Download, Plug, RotateCcw, ShieldCheck } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { hasMinimumRole } from '../../config/roles'
import { formatDateTime, formatRole } from '../../lib/format'
import type { UserRole } from '../../types'
import { PERSONAS, STATUS_TONE, money, type DBillingLine } from './data'
import { downloadCsv, label, selectClass } from './helpers'
import { billableTrips, useDemo } from './store'
import { Table } from './Table'

const statusTone = { DRAFT: 'neutral', APPROVED: 'blue', FINALIZED: 'blue', EXPORTED: 'green' } as const

export function BillingScreen() {
  const { state, dispatch, notify } = useDemo()
  const { billing } = state.data
  const lines: DBillingLine[] = billing.status === 'DRAFT' ? billableTrips(state.data) : billing.lines
  const total = lines.reduce((s, l) => s + l.fare, 0)

  return (
    <>
      <PageHeader
        title="Billing"
        description="Billing periods built from trips' existing fares. Finalize to lock the numbers, then export for your billing system."
      />
      <div className="mt-5">
        <Card
          title="This week"
          subtitle={`${lines.length} completed trips · ${money(total)}`}
          actions={<Badge tone={statusTone[billing.status]}>{billing.status}</Badge>}
        >
          {lines.length === 0 ? (
            <EmptyState title="Nothing to bill yet" description="Completed trips with a fare appear here automatically." />
          ) : (
            <Table head={['Trip', 'Route', 'Fare']}>
              {lines.map((l) => (
                <tr key={l.tripId}>
                  <td className="py-2.5 pr-4 text-slate-400">{l.tripId.toUpperCase()}</td>
                  <td className="py-2.5 pr-4 text-slate-700">{l.route}</td>
                  <td className="py-2.5 pr-4 font-medium text-slate-700">{money(l.fare)}</td>
                </tr>
              ))}
            </Table>
          )}
          <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
            {billing.status === 'DRAFT' ? (
              <Button
                disabled={lines.length === 0}
                onClick={() => {
                  dispatch({ type: 'finalizeBilling' })
                  notify('Finalized. The numbers are locked and the action is in the audit trail.')
                }}
              >
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Finalize
              </Button>
            ) : (
              <>
                <Button variant="secondary" onClick={() => dispatch({ type: 'reopenBilling' })}>
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Reopen to draft
                </Button>
                <Button
                  onClick={() => {
                    downloadCsv('billing-demo.csv', [
                      ['Trip', 'Route', 'Fare (USD)'],
                      ...billing.lines.map((l) => [l.tripId, l.route, l.fare.toFixed(2)]),
                    ])
                    dispatch({ type: 'exportBilling' })
                    notify('A CSV was downloaded. Your billing system can import it.')
                  }}
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Export CSV
                </Button>
              </>
            )}
          </div>
        </Card>
      </div>
    </>
  )
}

export function PayrollScreen() {
  const { state, dispatch, notify } = useDemo()
  const { drivers, trips, payroll } = state.data
  const staff = drivers.filter((d) => d.hasLogin)
  const locked = payroll.status !== 'DRAFT'
  const total = Object.values(payroll.amounts).reduce((s, v) => s + (Number(v) || 0), 0)

  return (
    <>
      <PageHeader title="Payroll" description="Driver pay for the period. Amounts are entered by you: the app never calculates pay." />
      <div className="mt-5">
        <Card title="This week" subtitle={`Total ${money(total)}`} actions={<Badge tone={statusTone[payroll.status]}>{payroll.status}</Badge>}>
          <Table head={['Driver', 'Completed trips (for reference)', 'Pay (USD)']}>
            {staff.map((d) => (
              <tr key={d.id}>
                <td className="py-2.5 pr-4 font-medium text-slate-800">{d.name}</td>
                <td className="py-2.5 pr-4 text-slate-400">{trips.filter((t) => t.driverId === d.id && t.status === 'COMPLETED').length}</td>
                <td className="py-2.5 pr-4">
                  <input
                    type="number"
                    aria-label={`Pay for ${d.name}`}
                    value={payroll.amounts[d.id] ?? ''}
                    disabled={locked}
                    placeholder="0.00"
                    onChange={(e) => dispatch({ type: 'setPayrollAmount', driverId: d.id, value: e.target.value })}
                    className={`w-28 ${selectClass}`}
                  />
                </td>
              </tr>
            ))}
          </Table>
          <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
            {payroll.status === 'DRAFT' ? (
              <Button
                disabled={total <= 0}
                onClick={() => {
                  dispatch({ type: 'approvePayroll' })
                  notify('Payroll approved and logged in the audit trail.')
                }}
              >
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Approve
              </Button>
            ) : (
              <>
                <Button variant="secondary" onClick={() => dispatch({ type: 'reopenPayroll' })}>
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Reopen to draft
                </Button>
                <Button
                  onClick={() => {
                    downloadCsv('payroll-demo.csv', [
                      ['Driver', 'Amount (USD)'],
                      ...staff.map((d) => [d.name, (Number(payroll.amounts[d.id]) || 0).toFixed(2)]),
                    ])
                    dispatch({ type: 'exportPayroll' })
                    notify('A CSV was downloaded for whoever runs your payroll.')
                  }}
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Export CSV
                </Button>
              </>
            )}
          </div>
          {total <= 0 && !locked && <p className="mt-2 text-right text-xs text-slate-400">Enter at least one amount to approve.</p>}
        </Card>
      </div>
    </>
  )
}

export function ReportsScreen() {
  const { state } = useDemo()
  const { trips, vehicles, inspections } = state.data
  const done = trips.filter((t) => t.status === 'COMPLETED').length
  const closed = trips.filter((t) => ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(t.status)).length
  const revenue = trips.filter((t) => t.status === 'COMPLETED').reduce((s, t) => s + t.fare, 0)
  const byStatus = trips.reduce<Record<string, number>>((a, t) => ({ ...a, [t.status]: (a[t.status] ?? 0) + 1 }), {})
  const fleet = vehicles.reduce<Record<string, number>>((a, v) => ({ ...a, [v.status]: (a[v.status] ?? 0) + 1 }), {})
  const flagged = inspections.filter((i) => i.status === 'FLAGGED' || (i.status === 'SUBMITTED' && i.autoFlagged)).length

  const tiles = [
    ['Trips', String(trips.length)],
    ['Completion rate', closed ? `${Math.round((done / closed) * 100)}%` : '–'],
    ['Revenue (completed)', money(revenue)],
    ['Inspections flagged', `${flagged} of ${inspections.length}`],
  ]
  return (
    <>
      <PageHeader title="Reports" description="Computed live from trips, vehicles and inspections: not a separate system you keep in sync." />
      <div className="mt-5 grid grid-cols-2 gap-3">
        {tiles.map(([l, v]) => (
          <div key={l} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xl font-bold text-slate-900">{v}</p>
            <p className="text-xs text-slate-500">{l}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Card title="Trips by status">
          <div className="space-y-2">
            {Object.entries(byStatus).map(([s, n]) => (
              <div key={s} className="flex items-center justify-between">
                <Badge tone={STATUS_TONE[s as keyof typeof STATUS_TONE]}>{label(s)}</Badge>
                <span className="text-sm font-medium text-slate-700">{n}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Fleet utilization">
          <div className="space-y-2">
            {Object.entries(fleet).map(([s, n]) => (
              <div key={s} className="flex items-center justify-between">
                <Badge tone={s === 'AVAILABLE' ? 'green' : s === 'ASSIGNED' ? 'blue' : 'amber'}>{label(s)}</Badge>
                <span className="text-sm font-medium text-slate-700">{n}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <p className="mt-4 flex items-center gap-2 text-xs text-slate-400">
        <BarChart3 className="h-4 w-4" aria-hidden="true" />
        Complete a trip as the Driver, then come back: the numbers change.
      </p>
    </>
  )
}

export function UsersScreen() {
  const { state, dispatch, notify } = useDemo()
  const { users } = state.data
  const me = PERSONAS[state.role].name
  const isAdmin = state.role === 'ADMIN'
  const roles: UserRole[] = ['ADMIN', 'MANAGER', 'DISPATCHER', 'DRIVER']

  return (
    <>
      <PageHeader title="Users" description="Who can sign in, and what they can do." />
      <div className="mt-5">
        <Card title="Team" subtitle={`${users.length} logins`}>
          <Table head={['Name', 'Role', 'Status', 'Actions']}>
            {users.map((u) => {
              const self = u.name === me
              return (
                <tr key={u.id}>
                  <td className="py-2.5 pr-4 font-medium text-slate-800">
                    {u.name}
                    {self && <span className="ml-2 text-xs text-slate-400">(you)</span>}
                  </td>
                  <td className="py-2.5 pr-4">
                    {isAdmin && !self ? (
                      <select
                        aria-label={`Role for ${u.name}`}
                        className={selectClass}
                        value={u.role}
                        onChange={(e) => {
                          dispatch({ type: 'setUserRole', id: u.id, role: e.target.value as UserRole })
                          notify('Role changed and logged in the audit trail.')
                        }}
                      >
                        {roles.map((r) => (
                          <option key={r} value={r}>
                            {formatRole(r)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Badge tone="blue">{formatRole(u.role)}</Badge>
                    )}
                  </td>
                  <td className="py-2.5 pr-4">
                    <Badge tone={u.active ? 'green' : 'neutral'}>{u.active ? 'ACTIVE' : 'DISABLED'}</Badge>
                  </td>
                  <td className="py-2.5 pr-4">
                    {!self && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          dispatch({ type: 'toggleUser', id: u.id })
                          notify('Status changed and logged in the audit trail.')
                        }}
                      >
                        {u.active ? 'Deactivate' : 'Reactivate'}
                      </Button>
                    )}
                  </td>
                </tr>
              )
            })}
          </Table>
          <p className="mt-3 text-xs text-slate-400">
            {isAdmin ? 'You can change roles. You cannot change your own.' : 'Managers can switch logins on or off. Only an Admin can change roles.'}
          </p>
        </Card>
      </div>
    </>
  )
}

export function AuditScreen() {
  const { state } = useDemo()
  return (
    <>
      <PageHeader title="Audit trail" description="Every significant action, permanently. Entries cannot be edited or deleted, by anyone." />
      <div className="mt-5">
        <Card title="Entries" subtitle={`${state.data.audit.length} entries, newest first`}>
          <Table head={['When', 'Action', 'Who', 'Target', 'Details']}>
            {state.data.audit.map((a) => (
              <tr key={a.id}>
                <td className="whitespace-nowrap py-2.5 pr-4 text-slate-500">{formatDateTime(a.at)}</td>
                <td className="py-2.5 pr-4 text-slate-700">{a.action}</td>
                <td className="py-2.5 pr-4">
                  <span className="text-slate-700">{a.actor}</span> <Badge tone="blue">{formatRole(a.role)}</Badge>
                </td>
                <td className="py-2.5 pr-4 text-slate-500">{a.target}</td>
                <td className="py-2.5 pr-4 text-xs text-slate-400">{a.details ?? '–'}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </>
  )
}

export function IntegrationsScreen() {
  const items = [
    ['Billing systems', 'QuickBooks, broker portals, Medicaid claims', 'Trips and fares already export as CSV today.'],
    ['Vehicle telematics', 'Verizon Connect, Geotab, Samsara', 'Last-known status is entered by hand today.'],
    ['Maps and navigation', 'Google Maps Platform', 'Connected: addresses are verified when you schedule a trip.'],
    ['Payroll providers', 'Gusto, ADP, Paychex', 'Payroll exports as CSV today.'],
  ]
  return (
    <>
      <PageHeader title="Integration Center" description="Each outside system connects through its own adapter, so adding or swapping one never means rebuilding the app." />
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {items.map(([t, ex, now]) => (
          <Card key={t}>
            <div className="flex items-start gap-3">
              <Plug className="mt-0.5 h-5 w-5 text-slate-400" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-slate-900">{t}</p>
                <p className="text-xs text-slate-400">{ex}</p>
                <p className="mt-2 text-sm text-slate-600">{now}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  )
}

export function SettingsScreen() {
  return (
    <>
      <PageHeader title="Settings" description="Organization-level settings." />
      <div className="mt-5">
        <Card>
          <p className="text-sm text-slate-600">
            Sign-in security is already enforced: passwords of 12+ characters, automatic sign-out after 20 minutes idle, and a permanent audit trail.
          </p>
        </Card>
      </div>
    </>
  )
}

export function HelpScreen() {
  const { state } = useDemo()
  const role = state.role
  const sections: [string, string, UserRole?][] = [
    ['Trips and dispatch', 'Schedule a trip, then assign a driver and vehicle from the Dispatch board.', 'DISPATCHER'],
    ['Drivers and vehicles', 'Keep the roster and fleet current. Update a vehicle’s last known status by hand.', 'DISPATCHER'],
    ['Inspections', 'Review what drivers submit and approve or flag it.', 'DISPATCHER'],
    ['Payroll and billing', 'Enter pay, approve it, finalize billing, export CSVs.', 'MANAGER'],
    ['Reports and users', 'Live reports; switch logins on or off.', 'MANAGER'],
    ['Audit trail', 'A permanent record of who did what and when.', 'ADMIN'],
  ]
  return (
    <>
      <PageHeader title="Help & guide" description="Built in, and filtered to what your role can do, so nobody needs separate instructions." />
      <div className="mt-5 space-y-3">
        {sections
          .filter(([, , min]) => !min || hasMinimumRole(role, min))
          .map(([t, b]) => (
            <Card key={t} title={t}>
              <p className="text-sm text-slate-600">{b}</p>
            </Card>
          ))}
      </div>
    </>
  )
}
