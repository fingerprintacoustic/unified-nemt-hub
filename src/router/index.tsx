import { createBrowserRouter, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '../components/auth/ProtectedRoute'
import { AppLayout } from '../components/layout/AppLayout'
import { DriverLayout } from '../components/layout/DriverLayout'
import { AuditPage } from '../pages/audit/AuditPage'
import { LoginPage } from '../pages/auth/LoginPage'
import { DashboardPage } from '../pages/dashboard/DashboardPage'
import { DispatchPage } from '../pages/dispatch/DispatchPage'
import { DriverHomePage } from '../pages/driver/DriverHomePage'
import { DriverInspectionsPage } from '../pages/driver/DriverInspectionsPage'
import { DriversPage } from '../pages/drivers/DriversPage'
import { InspectionsPage } from '../pages/inspections/InspectionsPage'
import { IntegrationsPage } from '../pages/integrations/IntegrationsPage'
import { NotFoundPage } from '../pages/NotFound'
import { BillingPage } from '../pages/billing/BillingPage'
import { PayrollPage } from '../pages/payroll/PayrollPage'
import { ReportsPage } from '../pages/reports/ReportsPage'
import { SettingsPage } from '../pages/settings/SettingsPage'
import { TripsPage } from '../pages/trips/TripsPage'
import { UsersPage } from '../pages/users/UsersPage'
import { VehiclesPage } from '../pages/vehicles/VehiclesPage'

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    element: <ProtectedRoute staffApp>{<AppLayout />}</ProtectedRoute>,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'drivers', element: <ProtectedRoute minRole="DISPATCHER"><DriversPage /></ProtectedRoute> },
      { path: 'vehicles', element: <ProtectedRoute minRole="DISPATCHER"><VehiclesPage /></ProtectedRoute> },
      { path: 'trips', element: <ProtectedRoute minRole="DISPATCHER"><TripsPage /></ProtectedRoute> },
      { path: 'dispatch', element: <ProtectedRoute minRole="DISPATCHER"><DispatchPage /></ProtectedRoute> },
      { path: 'inspections', element: <ProtectedRoute minRole="DISPATCHER"><InspectionsPage /></ProtectedRoute> },
      { path: 'payroll', element: <ProtectedRoute minRole="MANAGER"><PayrollPage /></ProtectedRoute> },
      { path: 'billing', element: <ProtectedRoute minRole="MANAGER"><BillingPage /></ProtectedRoute> },
      { path: 'reports', element: <ProtectedRoute minRole="MANAGER"><ReportsPage /></ProtectedRoute> },
      { path: 'users', element: <ProtectedRoute minRole="MANAGER"><UsersPage /></ProtectedRoute> },
      { path: 'audit', element: <ProtectedRoute minRole="ADMIN"><AuditPage /></ProtectedRoute> },
      { path: 'integrations', element: <ProtectedRoute minRole="ADMIN"><IntegrationsPage /></ProtectedRoute> },
      { path: 'settings', element: <ProtectedRoute minRole="ADMIN"><SettingsPage /></ProtectedRoute> },
    ],
  },
  {
    path: '/driver',
    element: <ProtectedRoute driverApp>{<DriverLayout />}</ProtectedRoute>,
    children: [
      { index: true, element: <DriverHomePage /> },
      { path: 'inspections', element: <DriverInspectionsPage /> },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
])