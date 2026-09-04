import { Loader2 } from 'lucide-react'

interface FullScreenLoaderProps {
  label?: string
}

export function FullScreenLoader({ label = 'Loading…' }: FullScreenLoaderProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 text-slate-500">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" aria-hidden="true" />
      <p className="mt-3 text-sm">{label}</p>
    </div>
  )
}