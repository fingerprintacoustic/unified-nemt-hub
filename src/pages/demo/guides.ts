import type { UserRole } from '../../types'

export interface GuideStep {
  /** Key in the demo's "done" map; steps without one are plain notes. */
  key?: string
  title: string
  body: string
  /** Screen to open when the user presses "Take me there". */
  page?: string
}

export interface RoleGuide {
  role: UserRole
  label: string
  who: string
  canDo: string[]
  cannotDo: string[]
  intro: string
  steps: GuideStep[]
}

export const GUIDES: RoleGuide[] = [
  {
    role: 'DISPATCHER',
    label: 'Dispatcher',
    who: 'Dana Reyes runs the day-to-day: scheduling trips and getting the right driver and vehicle on each one.',
    canDo: ['Schedule and assign trips', 'Manage drivers and vehicles', 'Review driver inspections'],
    cannotDo: ['Payroll, billing, reports', 'Manage users', 'Audit trail'],
    intro: 'You are Dana, a dispatcher. Work through these in any order. Everything you do is visible to the other roles.',
    steps: [
      {
        key: 'visited:dashboard',
        title: 'Check the dashboard',
        body: 'Live counts of active trips, vehicles in service, drivers and open issues, plus the most recent trips.',
        page: 'dashboard',
      },
      {
        key: 'assignedTrip',
        title: 'Assign a driver and vehicle',
        body: 'The trip marked Scheduled has nobody on it yet. Pick Marcus Bell and a vehicle, then press Assign. Then switch to the Driver role: the trip is now on his phone.',
        page: 'dispatch',
      },
      {
        key: 'scheduledTrip',
        title: 'Schedule a new trip',
        body: 'Add a trip with a pickup time, pickup and drop-off place, and mobility need. In the real app addresses are verified with Google Maps.',
        page: 'trips',
      },
      {
        key: 'reviewedInspection',
        title: 'Review an inspection',
        body: 'Drivers submit pre- and post-trip checks from their phones. One reports a brake problem: flag it, or approve a clean one.',
        page: 'inspections',
      },
      {
        key: 'updatedVehicle',
        title: "Update a vehicle's status",
        body: 'Change a vehicle to Maintenance, or record where it was last seen. Live GPS from a telematics provider can plug in here later.',
        page: 'vehicles',
      },
      {
        title: 'Notice what is missing from the menu',
        body: 'Payroll, Billing, Reports, Users and Audit trail are locked for dispatchers. Access is enforced by the database, not just hidden in the menu. Switch to Manager to see them.',
      },
    ],
  },
  {
    role: 'MANAGER',
    label: 'Manager',
    who: 'Priya Shah handles the money side: billing the brokers, paying drivers and watching the numbers.',
    canDo: ['Everything a dispatcher can', 'Payroll and billing', 'Reports', 'Manage users'],
    cannotDo: ['Audit trail', 'Integrations and settings'],
    intro: 'You are Priya, an operations manager. If you assigned or completed trips as another role, they appear here.',
    steps: [
      {
        key: 'finalizedBilling',
        title: 'Finalize a billing period',
        body: 'Every completed trip with a fare is listed automatically. Finalizing locks the numbers so what you send never changes under you.',
        page: 'billing',
      },
      {
        key: 'exportedBilling',
        title: 'Export for your billing system',
        body: 'The export is a CSV that your existing billing system or broker portal can import. Direct connections are added per vendor later.',
        page: 'billing',
      },
      {
        key: 'approvedPayroll',
        title: 'Enter pay and approve payroll',
        body: 'Type each driver’s pay for the period and approve it. The app never calculates pay: that is your policy, not ours.',
        page: 'payroll',
      },
      {
        key: 'visited:reports',
        title: 'Open the reports',
        body: 'Trip volume, completion rate, revenue, fleet use and inspection compliance, all computed live from the trips and inspections.',
        page: 'reports',
      },
      {
        key: 'toggledUser',
        title: 'Switch off a login',
        body: 'Press Deactivate next to Terrence Cole, as you would when someone leaves. You can switch him back on. Every change is recorded in the audit trail.',
        page: 'users',
      },
      {
        title: 'The audit trail is admin-only',
        body: 'Switch to Admin to see a permanent record of what you just did.',
      },
    ],
  },
  {
    role: 'ADMIN',
    label: 'Admin',
    who: 'Alex Morgan owns the business and has full access, including the audit trail and system settings.',
    canDo: ['Everything a manager can', 'Audit trail', 'Delete records', 'Integrations and settings'],
    cannotDo: ['Edit or erase the audit trail (nobody can)'],
    intro: 'You are Alex, the administrator. Every screen is open to you.',
    steps: [
      {
        key: 'visited:audit',
        title: 'Read the audit trail',
        body: 'A permanent log of who did what and when. Actions you took as Dispatcher or Manager are in it. Entries can never be edited or deleted.',
        page: 'audit',
      },
      {
        key: 'changedRole',
        title: "Change someone's role",
        body: 'Only an Admin can promote or demote people, so nobody can grant themselves more access. The change is logged.',
        page: 'users',
      },
      {
        key: 'deletedVehicle',
        title: 'Delete a vehicle (admin only)',
        body: 'Destructive actions are admin-only. Delete one, then look at the audit trail: the deletion is already logged.',
        page: 'vehicles',
      },
      {
        key: 'visited:integrations',
        title: 'See the Integration Center',
        body: 'Where billing systems, telematics and other vendors connect. Each vendor gets its own adapter, so adding one never means rebuilding the app.',
        page: 'integrations',
      },
      {
        key: 'visited:help',
        title: 'Open the built-in Help',
        body: 'The real app has a Help page for every role, so staff never need separate instructions.',
        page: 'help',
      },
    ],
  },
  {
    role: 'DRIVER',
    label: 'Driver',
    who: 'Marcus Bell drives. He uses the mobile app on his phone and only ever sees his own trips.',
    canDo: ['See only his assigned trips', 'Step each trip through its stages', 'Open directions', 'Submit inspections'],
    cannotDo: ['See other drivers’ trips', 'See any staff screen'],
    intro: 'You are Marcus, on your phone. If a dispatcher assigned you a trip in this demo, it is here.',
    steps: [
      {
        key: 'startedTrip',
        title: 'Start your first trip',
        body: 'Press the big button on the trip card. One tap per stage keeps it easy to use while driving.',
        page: 'trips',
      },
      {
        key: 'navigated',
        title: 'Open directions',
        body: 'Navigate opens the phone’s own maps app, pointed at the pickup, then the drop-off.',
        page: 'trips',
      },
      {
        key: 'completedTrip',
        title: 'Take a trip all the way to Completed',
        body: 'Picked up, dropped off, completed. Switch to Manager afterwards: the trip now appears as billable.',
        page: 'trips',
      },
      {
        key: 'submittedInspection',
        title: 'Submit a vehicle inspection',
        body: 'Pick the vehicle, rate its condition and note any damage. Dispatch sees it straight away.',
        page: 'inspect',
      },
      {
        key: 'visited:help',
        title: 'Open Help',
        body: 'Short instructions built into the app.',
        page: 'help',
      },
    ],
  },
]

export const FLOW = [
  { who: 'Dispatcher', what: 'Schedules the trip and assigns a driver and vehicle' },
  { who: 'Driver', what: 'Runs it from their phone, one tap per stage' },
  { who: 'Dispatcher', what: 'Reviews the vehicle inspection' },
  { who: 'Manager', what: 'Bills the completed trips and approves payroll' },
  { who: 'Admin', what: 'Audits everything, permanently' },
]
