import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { hasFirebaseConfig } from '../../config/env'
import { hasMinimumRole } from '../../config/roles'
import { useAuth } from '../../context/AuthContext'
import type { UserRole } from '../../types'
import { FullScreenLoader } from '../ui/FullScreenLoader'

interface ProtectedRouteProps {
  children: ReactNode
  /** Minimum role required (server rules remain authoritative)..
  */
  minRole?: UserRole
  /** When true, only the staff application shell is used. */
  staffApp?: boolean
  /** When true, only the driver PWA shell is used. */
  driverApp?: boolean
}

export function ProtectedRoute({ children, minRole, staffApp, driverApp }: ProtectedRouteProps) {
  const { status, userRecord } = useAuth()
  const location = useLocation()

  if (!hasFirebaseConfig()) {
    // Local dev without Firebase — allow browsing the shell unauthenticated..
    return <>{children}</>
  }

  if (status === 'loading') {
    return <FullScreenLoader label="Checking your session…" />
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  const role = userRecord?.role
  if (minRole && !hasMinimumRole(role, minRole)) {
    return <Navigate to="/dashboard" replace />
  }

  if (staffApp && role === 'DRIVER') {
    return <Navigate to="/driver" replace />
  }

  if (driverApp && role !== 'DRIVER') {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}