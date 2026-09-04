import { useState } from 'react'
import { Bell, Menu, Search } from 'lucide-react'
import { hasFirebaseConfig } from '../../config/env'
import { useAuth } from '../../context/AuthContext'
import { initialsFrom } from '../../lib/format'

interface HeaderProps {
  onOpenSidebar: () => void
}

export function Header({ onOpenSidebar }: HeaderProps) {
  const { user, userRecord } = useAuth()
  const [showProfile, setShowProfile] = useState(false)

  const fullName = userRecord ? `${userRecord.firstName} ${userRecord.lastName}`.trim() : ''
  const displayName = user?.displayName ?? (fullName || 'User')

  const toggleProfile = () => setShowProfile((shown) => !shown)

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
      <button
        type="button"
        onClick={onOpenSidebar}
        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      <div className="relative hidden max-w-md flex-1 md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          type="search"
          placeholder="Search trips, drivers, vehicles…"
          className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        {hasFirebaseConfig() && (
          <span className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            Connected
          </span>
        )}
        <button
          type="button"
          className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white" aria-hidden="true" />
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={toggleProfile}
            className="flex items-center gap-2 rounded-full p-1 hover:bg-slate-100"
            aria-label="Account menu"
            aria-expanded={showProfile}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-white">
              
{initialsFrom(displayName)}
            </span>
            <span className="hidden text-sm font-medium text-slate-700 sm:block">{displayName}</span>
          </button>
          {showProfile && (
            <div className="absolute right-0 top-12 w-56 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
              <div className="border-b border-slate-100 px-3 py-2.5">
                <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
                <p className="truncate text-xs text-slate-500">{user?.email}</p>
                {userRecord?.role && (
                  <p className="mt-1 text-xs font-medium text-blue-600">{formatRoleLabel(userRecord.role)}</p>
                )}
              </div>
              <p className="px-3 py-2 text-xs text-slate-400">
                Notifications, profile management, and organization settings arrive in a later phase..
              </p>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

function formatRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    ADMIN: 'Administrator',
    MANAGER: 'Manager',
    DISPATCHER: 'Dispatcher',
    DRIVER: 'Driver',
  }
  return labels[role] ?? role
}