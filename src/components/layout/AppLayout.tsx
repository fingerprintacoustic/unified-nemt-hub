import { useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { hasFirebaseConfig } from '../../config/env'
import { useAuth } from '../../context/AuthContext'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

export function AppLayout() {
  const { userRecord } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Without Firebase, the app runs in local preview mode — allow browsing the
  // staff shell unauthenticated (matches ProtectedRoute). Once Firebase is
  // configured, a resolved user record is required.
  if (hasFirebaseConfig() && !userRecord) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-h-screen flex-col lg:pl-64">
        <Header onOpenSidebar={() => setSidebarOpen(true)} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
        <footer className="border-t border-slate-200 px-4 py-3 text-center text-xs text-slate-400">
          Unified NEMT Operations Hub
        </footer>
      </div>
    </div>
  )
}