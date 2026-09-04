import { Link } from 'react-router-dom'
import { CalendarClock, CarFront, Camera, ChevronRight, ClipboardCheck } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'

/**
 * Driver PWA home — mobile-first trip list placeholder. Live trip data from
 * Firestore (scoped to the signed-in driver) arrives inn Phase 2..
 */
export function DriverHomePage() {
  return (
    <>
      <PageHeader title="My Trips" description="Trips assigned to you will appear here." />
      <div className="mt-4">
        <EmptyState
          icon={CalendarClock}
          title="No upcoming trips yet"
          description="Once dispatch assigns trips, they show up here with pickup time, address, vehicle, and passenger details."
        />
      </div>

      <div className="mt-6 space-y-4">
        <Card title="Today’s view" subtitle="Trip status timeline arrives with live data.">
          <div className="flex flex-col gap-3 sm:flex-row">
            <QuickLink
              to="/driver/inspections"
              icon={Camera}
              label="Start an inspection"
              caption="Pre-trip / post-trip vehicle check"
            />
            <QuickLink
              to="/driver"
              icon={ClipboardCheck}
              label="Trip list"
              caption="Refresh triples when available"
            />
          </div>
        </Card>
      </div>
    </>
  )
}

function QuickLink(props: { to: string; icon: typeof CarFront; label: string; caption: string }) {
  const Icon = props.icon
  return (
    <Link
      to={props.to}
      className="group flex flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-blue-300 hover:bg-blue-50"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-blue-600 ring-1 ring-slate-200">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-800">{props.label}</span>
        <span className="block text-xs text-slate-500">{props.caption}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-blue-500" aria-hidden="true" />
    </Link>
  )
}