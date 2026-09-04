import {
  Activity,
  AlertTriangle,
  CarFront,
  CheckCircle2,
  ClipboardCheck,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { hasFirebaseConfig } from '../../config/env'
import { useAuth } from '../../context/AuthContext'
import { isStaffRole } from '../../config/roles'
import { formatRole } from '../../lib/format'

interface SummaryCard {
  label: string
  value: string
  hint: string
  icon: LucideIcon
  tone: 'neutral' | 'green' | 'amber' | 'blue'
}

const toneClasses: Record<SummaryCard['tone'], string> = {
  neutral: 'bg-slate-50 text-slate-600',
  green: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  blue: 'bg-blue-50 text-blue-600',
}

export function DashboardPage() {
  const { user, userRecord } = useAuth()
  const isStaff = isStaffRole(userRecord?.role)
  const role = userRecord?.role

  const summaryCards: SummaryCard[] = [
    { label: 'Active Trips', value: '—', hint: 'Dispatch module (Phase 2)', icon: ClipboardCheck, tone: 'blue' },
    { label: 'Vehicles in service', value: '—', hint: 'Fleet module (Phase 2)', icon: CarFront, tone: 'green' },
    { label: 'Active Drivers', value: '—', hint: 'Drivers module (Phase 2)', icon: Users, tone: 'neutral' },
    { label: 'Open issues', value: '0', hint: 'From inspections and alerts', icon: AlertTriangle, tone: 'amber' },
  ]

  const recentActivity: { title: string; time: string; icon: LucideIcon; tone: 'green' | 'blue' | 'amber' | 'neutral' }[] = [
    { title: 'No recent activity yet', time: '—', icon: Activity, tone: 'neutral' },
  ]

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={
          hasFirebaseConfig()
            ? `Welcome back, ${firstName(userRecord?.firstName)}.`
            : 'Local development preview — Firebase not configured..'
        }
      />

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.label} className="p-0">
            <div className="flex items-center gap-4 px-5 py-4">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${toneClasses[card.tone]}`}>
                <card.icon className="h-5.5 w-5.5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-slate-900">{card.value}</p>
                <p className="truncate text-sm text-slate-500">{card.label}</p>
              </div>
            </div>
            <div className="border-t border-slate-100 px-5 py-2 text-xs text-slate-400">{card.hint}</div>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Recent activity" subtitle="Live activity streaming arrives in a later phase.">
            <ul className="divide-y divide-slate-100">
              {recentActivity.map((item) => (
                <li key={item.title} className="flex items-center gap-3 py-3">
                  <Activity className="h-4.5 w-4.5 text-slate-400" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-700">{item.title}</p>
                    <p className="text-xs text-slate-400">{item.time}</p>
                  </div>
                </li>
              ))}
            </ul>
            <EmptyState
              icon={Activity}
              title="Live activity will appear here"
              description="Once trips, inspections, and dispatch are wired up, the dashboard becomes the single place to run the business.."
            />
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="System status">
            <div className="space-y-3">
              <StatusRow dot="bg-emerald-500" label="Application shell" detail="Healthy" />
              <StatusRow dot={hasFirebaseConfig() ? 'bg-emerald-500' : 'bg-amber-500'} label="Firebase" detail={hasFirebaseConfig() ? 'Configured' : 'Not configured — local preview'} />
              <StatusRow dot="bg-emerald-500" label="Routing" detail="React Router v7 active" />
              <StatusRow dot="bg-slate-300" label="Backend services" detail="Phase 2 (Cloud Functions)" />
            </div>
          </Card>

          <Card title="Your session">
            <div className="space-y-2 text-sm">
              <p className="flex items-center justify-between">
                <span className="text-slate-500">Signed in as</span>
                <span className="font-medium text-slate-700">{user?.email ?? '—'}</span>
              </p>
              <p className="flex items-center justify-between">
                <span className="text-slate-500">Role</span>
                <Badge tone={role === 'ADMIN' ? 'violet' : role === 'MANAGER' ? 'blue' : role === 'DISPATCHER' ? 'green' : 'neutral'}>
                  {formatRole(role ?? '—')}
                </Badge>
              </p>
              {userRecord?.organizationId && (
                <p className="flex items-center justify-between">
                  <span className="text-slate-500">Organization</span>
                  <span className="max-w-[55%] truncate font-medium text-slate-700">{userRecord.organizationId}</span>
                </p>
              )}
            </div>
          </Card>

          <Card title="Quick actions">
            <div className="flex flex-wrap gap-2">
              <Badge tone="blue">{isStaff ? 'Dispatch queue' : 'My trips'}</Badge>
              <Badge tone="green">Inspections</Badge>
              <Badge tone="neutral">Coming in Phase 2</Badge>
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}

function StatusRow({ dot, label, detail }: { dot: string; label: string; detail: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <p className="text-xs text-slate-400">{detail}</p>
      </div>
      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
    </div>
  )
}

function firstName(name: string | undefined): string {
  return name ?? 'there'
}