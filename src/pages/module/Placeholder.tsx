import { Hammer } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'

interface PlaceholderProps {
  title: string
  description: string
  phase?: string
}

/**
 * Reusable placeholder for modules not yet implemented.in this foundation phase.
 */
export function ModulePlaceholder({ title, description, phase = 'Phase 2' }: PlaceholderProps) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <EmptyState
        icon={Hammer}
        title={`${title} is not implemented yet`}
        description={`This module is scheduled for ${phase}. The section below explains what it will cover once built..`}
      />
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Badge tone="violet">Coming in {phase}</Badge>
          <h2 className="text-sm font-semibold text-slate-700">Planned scope</h2>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>
      </div>
    </>
  )
}