import {
  BarChart3,
  Camera,
  CarFront,
  CreditCard,
  Gauge,
  History,
  KeyRound,
  UserCog,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import { useAuth } from '../../context/AuthContext'
import { hasMinimumRole } from '../../config/roles'
import type { UserRole } from '../../types'

interface HelpSection {
  id: string
  title: string
  icon: LucideIcon
  minRole?: UserRole
  body: React.ReactNode
}

export function HelpPage() {
  const { userRecord } = useAuth()
  const role = userRecord?.role

  const sections: HelpSection[] = [
    {
      id: 'getting-started',
      title: 'Getting started',
      icon: KeyRound,
      body: (
        <>
          <p>
            Access is role-based: <b>Admin</b> has full access plus Integrations, Settings, and the
            audit trail; <b>Manager</b> adds Payroll, Billing, Reports, and Users; <b>Dispatcher</b>{' '}
            handles day-to-day Dispatch, Drivers, Vehicles, Trips, and Inspections; <b>Driver</b> only
            sees the mobile driver app.
          </p>
          <p>
            Forgot your password? Click <b>Forgot password?</b> on the sign-in screen &mdash; a reset
            link is emailed to you directly, no need to ask an administrator.
          </p>
          <p>
            For security, you&rsquo;re automatically signed out after 20 minutes without any activity.
            Just sign back in &mdash; nothing is lost.
          </p>
        </>
      ),
    },
    {
      id: 'dispatch',
      title: 'Trips & dispatch',
      icon: Gauge,
      minRole: 'DISPATCHER',
      body: (
        <>
          <p>
            Add a trip from the <b>Trips</b> page: set the pickup time, type the pickup and drop-off
            addresses, then click <b>Verify</b> next to each one to confirm it resolves to a real
            location before saving.
          </p>
          <p>
            The <b>Dispatch</b> board shows every trip that isn&rsquo;t finished yet, soonest first &mdash;
            assign a driver and vehicle right from there, or change a trip&rsquo;s status manually if
            you need to override what the driver&rsquo;s app shows.
          </p>
        </>
      ),
    },
    {
      id: 'fleet',
      title: 'Drivers & vehicles',
      icon: CarFront,
      minRole: 'DISPATCHER',
      body: (
        <>
          <p>
            Add a driver on the <b>Drivers</b> page. To let them use the mobile app, first create their
            login on the <b>Users</b> page with the Driver role, then link it from the driver&rsquo;s
            record &mdash; only Driver-role logins show up in that list.
          </p>
          <p>
            On the <b>Vehicles</b> page, <b>Update status</b> records a vehicle&rsquo;s last known
            location, speed, and ignition state by hand &mdash; useful until live GPS tracking is
            connected for your fleet.
          </p>
        </>
      ),
    },
    {
      id: 'inspections',
      title: 'Inspections',
      icon: Camera,
      minRole: 'DISPATCHER',
      body: (
        <p>
          Drivers submit pre-trip and post-trip inspections from their own app. Review each one on the{' '}
          <b>Inspections</b> page and either <b>Approve</b> it or <b>Flag</b> it for follow-up &mdash;
          approving automatically updates that vehicle&rsquo;s last-inspection date.
        </p>
      ),
    },
    {
      id: 'payroll',
      title: 'Payroll',
      icon: Wallet,
      minRole: 'MANAGER',
      body: (
        <p>
          Create a pay period with a start and end date, enter each driver&rsquo;s pay amount by hand
          (this app doesn&rsquo;t calculate pay for you), then <b>Save &amp; approve</b>. Once approved,{' '}
          <b>Export CSV</b> to hand the numbers to whoever runs your actual payroll.
        </p>
      ),
    },
    {
      id: 'billing',
      title: 'Billing',
      icon: CreditCard,
      minRole: 'MANAGER',
      body: (
        <p>
          Create a billing period with a date range and, optionally, one broker to bill. While it&rsquo;s
          a draft, it shows a live preview of every completed, fared trip in that range. Click{' '}
          <b>Finalize</b> to lock those numbers in, then <b>Export CSV</b> for your billing system.
        </p>
      ),
    },
    {
      id: 'reports',
      title: 'Reports',
      icon: BarChart3,
      minRole: 'MANAGER',
      body: (
        <p>
          Pick a date range to see trip volume by status, completion rate, revenue from fared trips,
          current fleet utilization, and inspection compliance &mdash; all pulled live from your trips,
          vehicles, and inspections, not a separate report you have to keep in sync.
        </p>
      ),
    },
    {
      id: 'users',
      title: 'Users',
      icon: UserCog,
      minRole: 'MANAGER',
      body: (
        <p>
          Change a user&rsquo;s role or activate/deactivate their account here. Creating a brand-new
          login still needs your Fingerprint Acoustic contact to run a one-time setup step &mdash; a
          browser can&rsquo;t create someone else&rsquo;s account on its own.
        </p>
      ),
    },
    {
      id: 'audit',
      title: 'Audit trail',
      icon: History,
      minRole: 'ADMIN',
      body: (
        <p>
          Every role change, deletion, inspection review, and payroll/billing approval is recorded here
          permanently, with who did it and when &mdash; entries can never be edited or removed, by
          anyone, including an Admin.
        </p>
      ),
    },
  ]

  const visibleSections = sections.filter((s) => !s.minRole || hasMinimumRole(role, s.minRole))

  return (
    <>
      <PageHeader
        title="Help & guide"
        description="How to use this platform, organized by what you can actually do with your role."
      />

      <div className="mt-6 flex flex-wrap gap-2">
        {visibleSections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-600 hover:border-blue-300 hover:text-blue-700"
          >
            {s.title}
          </a>
        ))}
      </div>

      <div className="mt-6 space-y-6">
        {visibleSections.map((s) => (
          <div key={s.id} id={s.id} className="scroll-mt-6">
            <Card title={s.title}>
              <div className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <s.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="space-y-3 text-sm leading-6 text-slate-600">{s.body}</div>
              </div>
            </Card>
          </div>
        ))}
      </div>
    </>
  )
}
