import {
  BarChart3,
  Camera,
  CarFront,
  ClipboardCheck,
  CreditCard,
  Gauge,
  History,
  Home,
  Plug,
  Settings,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { UserRole } from '../types'
import { hasMinimumRole, isStaffRole } from './roles'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  /** Minimum role required to see this item (UI gate; server rules are authoritative)). */
  minRole?: UserRole
  /** Staff-side modules that drivers never see. */
  staffOnly?: boolean
}

export const MAIN_NAV: readonly NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: Home },
  { label: 'Drivers', href: '/drivers', icon: Users, minRole: 'DISPATCHER' },
  { label: 'Vehicles', href: '/vehicles', icon: CarFront, minRole: 'DISPATCHER' },
  { label: 'Trips', href: '/trips', icon: ClipboardCheck, minRole: 'DISPATCHER' },
  { label: 'Dispatch', href: '/dispatch', icon: Gauge, minRole: 'DISPATCHER' },
  { label: 'Inspections', href: '/inspections', icon: Camera, minRole: 'DISPATCHER' },
  { label: 'Payroll', href: '/payroll', icon: Wallet, minRole: 'MANAGER' },
  { label: 'Billing', href: '/billing', icon: CreditCard, minRole: 'MANAGER' },
  { label: 'Reports', href: '/reports', icon: BarChart3, minRole: 'MANAGER' },
  { label: 'Users', href: '/users', icon: UserCog, minRole: 'MANAGER' },
  { label: 'Audit trail', href: '/audit', icon: History, minRole: 'ADMIN' },
  { label: 'Integrations', href: '/integrations', icon: Plug, minRole: 'ADMIN' },
  { label: 'Settings', href: '/settings', icon: Settings, minRole: 'ADMIN' },
 ] as const

export const DRIVER_NAV: readonly NavItem[] = [
  { label: 'My Trips', href: '/driver', icon: ClipboardCheck },
  { label: 'Inspections', href: '/driver/inspections', icon: Camera },
]

export function navItemsFor(role: UserRole | undefined | null): NavItem[] {
  if (role === 'DRIVER') {
    return [...DRIVER_NAV]
  }
  if (!isStaffRole(role)) {
    return MAIN_NAV.filter((item) => item.href === '/dashboard')
  }
  return MAIN_NAV.filter((item) =>
    item.staffOnly !== true && (item.minRole ? hasMinimumRole(role, item.minRole) : true),
  )
}