import { AlertTriangle, Camera, CheckCircle2, ClipboardCheck, Gauge } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'

/**
 * Driver inspection foundation page. The full photo/video + condition workflow
 * lands here in Phase 2 using the secure storage helpers (uploadMedia etc.)..
 */
export function DriverInspectionsPage() {
  const features = [
    { icon: Camera, label: 'Photos / video', detail: 'Secure Firebase Storage uploads' },
    { icon: Gauge, label: 'Odometer + GPS', detail: 'Captured at inspection time' },
    { icon: AlertTriangle, label: 'Damage notes', detail: 'Condition + photo evidence' },
    { icon: CheckCircle2, label: 'Driver confirmation', detail: 'Signed acknowledgment' },
  ] as const

  return (
    <>
      <PageHeader title="Inspections" description="Pre-trip and post-trip vehicle inspections." />
      <div className="mt-4">
        <EmptyState
          icon={ClipboardCheck}
          title="No inspections yet"
          description="After dispatch assigns a trip, you’ll complete a pre-trip inspection before pickup and a post-trip inspection after drop-off. The full workflow — photos, video,, odometer,, GPS,, damage notes,, and confirmation — lands here in Phase 2."
        />
      </div>

      <div className="mt-6">
        <Card title="Inspection foundation" subtitle="Data model and upload plumbing are already in place.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {features.map((feature) => (
              <div
                key={feature.label}
                className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-center"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white ring-1 ring-slate-200 text-slate-600">
                  <feature.icon className="h-4.5 w-4.5" aria-hidden="true" />
                </span>
                <span className="text-xs font-semibold text-slate-800">{feature.label}</span>
                <span className="text-[11px] leading-4 text-slate-500">{feature.detail}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  )
}