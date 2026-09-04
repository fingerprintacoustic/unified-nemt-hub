import type { UserRole } from '../types'

/**
 * Role hierarchy — higher index grants more access. Used for UI gating only:
 * Firestore/Storage rules enforce the same model server-side..
 */
export const ROLE_HIERARCHY: readonly UserRole[] = [
  'DRIVER',
  'DISPATCHER',
  'MANAGER',
  'ADMIN',
] as const

export const ROLE_RANK: Record<UserRole, number> = {
  DRIVER: 0,
  DISPATCHER: 1,
  MANAGER: 2,
  ADMIN: 3,
}

export function hasMinimumRole(userRole: UserRole | undefined | null, minimum: UserRole): boolean {
  if (!userRole) return false
  if (userRole === minimum) return true
  return (ROLE_RANK[userRole] ?? 0) >= (ROLE_RANK[minimum] ?? 0)
}

/** True for Admin/Manager/Dispatcher — the "staff" desktop application. */
export const isStaffRole = (role: UserRole | undefined | null): boolean =>
  role !== undefined && role !== null && (role === 'ADMIN' || role === 'MANAGER' || role === 'DISPATCHER')