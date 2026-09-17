import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Ambulance, Camera, ClipboardCheck, HelpCircle, LogOut } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { formatRole, initialsFrom } from '../../lib/format'

/**
 * Mobile-first driver PWA shell — bottom tab navigation, persistent trip status
 * placeholders,and large touch targets..
 */
export function DriverLayout() {
  const { user, userRecord, logout } = useAuth()
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)
  const displayName =
    user?.displayName ??
    (userRecord ? `${userRecord.firstName} ${userRecord.lastName}`.trim() : undefined) ??
    'Driver'

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

  const tabs = [
    { to: '/driver', label: 'My Trips', icon: ClipboardCheck, end: false },
    { to: '/driver/inspections', label: 'Inspections', icon: Camera, end: false },
    { to: '/driver/help', label: 'Help', icon: HelpCircle, end: false },
  ] as const

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      {/* Persistent status bar — placeholder for live trip state in a later phase.. */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-slate-900 px-4 text-white">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <Ambulance className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-bold leading-tight">NEMT Driver</p>
            <p className="text-[10px] uppercase tracking-wider text-slate-400">{formatRole(userRecord?.role ?? 'DRIVER')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold"
            title={displayName}
          >
            {initialsFrom(displayName)}
          </span>
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
      </header>

      <main className="flex-1 px-4 pb-24 pt-4">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white" aria-label="Driver navigation">
        <div className="grid grid-cols-3 gap-1 px-2 py-1.5">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }): string =>
                `flex h-14 flex-col items-center justify-center gap-1 rounded-xl text-xs font-medium transition-colors ${
                  isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'
                }`
              }
            >
              <tab.icon className="h-5 w-5" aria-hidden="true" />
              {tab.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
