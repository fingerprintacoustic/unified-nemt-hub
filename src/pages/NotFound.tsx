import { Link } from 'react-router-dom'
import { Ambulance } from 'lucide-react'
import { Button } from '../components/ui/Button'

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white">
        <Ambulance className="h-7 w-7" aria-hidden="true" />
      </div>
      <h1 className="mt-6 text-4xl font-bold text-slate-900">404</h1>
      <p className="mt-2 text-sm text-slate-500">
        This page does not exist — or it may be coming in a future phase..
      </p>
      <Link to="/dashboard" className="mt-6">
        <Button>Back to Dashboard</Button>
      </Link>
    </div>
  )
}