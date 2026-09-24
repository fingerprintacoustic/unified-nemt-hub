import { useState } from 'react'
import { useNavigate, NavLink } from 'react-router-dom'
import { Ambulance, LogOut, X } from 'lucide-react'
import { isStaffRole } from '../../config/roles'
import { navItemsFor } from '../../config/navigation'
import { useAuth } from '../../context/AuthContext'
import { formatRole, initialsFrom } from '../../lib/format'

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { user, userRecord, logout } = useAuth()
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)

  const items = navItemsFor(userRecord?.role)

  const role = userRecord?.role

  const displayName =
    user?.displayName ??
    (userRecord ? `${userRecord.firstName} ${userRecord.lastName}`.trim() : undefined) ??
    'User'

  const handleLogout = async () => {
    setSigningOut(true)
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch (error) {
      console.error('Logout failed:', error)
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-slate-900 text-slate-300 transition-transform duration-200 lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
        aria-label="Primary navigation"
      >
        <div className="flex h-16 items-center justify-between px-5">
          <NavLink to="/dashboard" className="flex items-center gap-2.5" onClick={onClose}>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
              <Ambulance className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-sm font-bold leading-tight text-white">
              NEMT Hub
              <span className="block text-[10px] font-medium uppercase tracking-wider text-slate-400">
                Operations
              </span>
            </span>
          </NavLink>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-white lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {items.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.href}
                to={item.href}
                onClick={onClose}
                className={({ isActive }): string =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                  }`
                }
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                {item.label}
              </NavLink>
            )
          })}
        </nav>

        <div className="border-t border-slate-800 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-white">
              {initialsFrom(displayName)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{displayName}</p>
              <p className="truncate text-xs text-slate-400">
                {formatRole(role ?? '')}
                {isStaffRole(role) && userRecord?.organizationId ? ' · Staff' : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={signingOut}
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-50"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-4.5 w-4.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}