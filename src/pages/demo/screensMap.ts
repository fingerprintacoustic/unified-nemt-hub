import type { ComponentType } from 'react'
import {
  AuditScreen,
  BillingScreen,
  HelpScreen,
  IntegrationsScreen,
  PayrollScreen,
  ReportsScreen,
  SettingsScreen,
  UsersScreen,
} from './AdminScreens'
import { DashboardScreen, DispatchScreen, DriversScreen, InspectionsScreen, TripsScreen, VehiclesScreen } from './OpsScreens'

/** Staff screens by the same ids the real app uses for its routes. */
export const SCREENS: Record<string, ComponentType> = {
  dashboard: DashboardScreen,
  help: HelpScreen,
  drivers: DriversScreen,
  vehicles: VehiclesScreen,
  trips: TripsScreen,
  dispatch: DispatchScreen,
  inspections: InspectionsScreen,
  payroll: PayrollScreen,
  billing: BillingScreen,
  reports: ReportsScreen,
  users: UsersScreen,
  audit: AuditScreen,
  integrations: IntegrationsScreen,
  settings: SettingsScreen,
}
