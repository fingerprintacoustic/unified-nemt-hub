import {
  Cable,
  Car,
  Camera,
  CreditCard,
  MapPinned,
  Plug,
  Radio,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'

interface IntegrationCategory {
  name: string
  description: string
  icon: LucideIcon
  examples: string[]
  planned: boolean
}

const CATEGORIES: IntegrationCategory[] = [
  {
    name: 'Vehicle / GPS telematics',
    description: 'Live vehicle position, speed, and ignition data from telematics providers.',
    icon: Car,
    examples: ['Verizon Connect', 'Geotab', 'Samsara'],
    planned: true,
  },
  {
    name: 'Camera dashcams',
    description: 'Vehicle camera systems for trip video, safety events, and incident review.',
    icon: Camera,
    examples: ['Lytx', 'Samsara dashcams', 'Netradyne'],
    planned: true,
  },
  {
    name: 'Payroll providers',
    description: 'Push approved trip/pay data to payroll processors and HR systems.',
    icon: Cable,
    examples: ['Gusto', 'ADP', 'Paychex'],
    planned: true,
  },
  {
    name: 'Billing systems',
    description: 'Trip-to-invoice pipelines for brokers, Medicaid/Medicare claims, and private clients.',
    icon: CreditCard,
    examples: ['NEMT broker portals', 'Medicaid claims APIs', 'QuickBooks'],
    planned: true,
  },
  {
    name: 'Mapping / navigation',
    description: 'Route optimization,and driver turn-by-turn navigation with NEMT-specific stops.',
    icon: MapPinned,
    examples: ['Google Maps Platform', 'Mapbox', 'Here'],
    planned: true,
  },
  {
    name: 'NEMT brokers',
    description: 'Trip order receive/acknowledge, ETA updates, and status feeds to broker platforms.',
    icon: Radio,
    examples: ['Broker exchange APIs', 'Trip order webhooks'],
    planned: true,
  },
]

export function IntegrationsPage() {
  return (
    <>
      <PageHeader
        title="Integration Center"
        description="Central hub for third-party connectivity. No providers are connected during this foundation phase — the architecture is built modularly so a vendor swap affects only its adapter.."
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {CATEGORIES.map((category) => (
          <Card key={category.name} className="flex flex-col">
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <category.icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{category.name}</h3>
                <p className="mt-1 text-sm text-slate-500">{category.description}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {category.examples.map((example) => (
                <Badge key={example} tone="neutral">
                  {example}
                </Badge>
              ))}
            </div>
            <div className="mt-auto pt-4">
              <Badge tone={category.planned ? 'amber' : 'neutral'}>
                {category.planned ? 'Planned' : 'Not planned'}
              </Badge>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-6">
        <Card title="Integration architecture">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex-1">
              <p className="text-sm leading-6 text-slate-500">
                Each provider integrates through a narrow, typed adapter interface. The rest of the
                application talks to that interface — never to a vendor SDK directly. Real adapters
                (plus secrets/keys for vendor APIs) arrive in later phases..
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge tone="blue">Adapters</Badge>
                <Badge tone="blue">Typed contracts</Badge>
                <Badge tone="blue">Vendor credentials in Secret Manager</Badge>
                <Badge tone="green">Health checks per connection</Badge>
              </div>
            </div>
            <div className="flex items-center justify-center rounded-xl bg-slate-900 p-6 text-slate-300 sm:w-64">
              <div className="text-center">
                <ShieldCheck className="mx-auto h-8 w-8 text-emerald-400" aria-hidden="true" />
                <p className="mt-2 text-xs font-medium">No external connections active</p>
                <p className="mt-1 text-[11px] text-slate-500">Foundation phase only</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <EmptyState
          icon={Plug}
          title="No integrations connected"
          description="Integration management, OAuth flows, credential storage, and connection health monitoring arrive in Phase 2+."
        />
      </div>
    </>
  )
}