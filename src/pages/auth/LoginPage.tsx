import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Ambulance, ArrowLeft, LogIn } from 'lucide-react'
import { hasFirebaseConfig } from '../../config/env'
import { useAuth } from '../../context/AuthContext'
import { sendPasswordReset } from '../../services/auth'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { FullScreenLoader } from '../../components/ui/FullScreenLoader'

interface LocationState {
  from?: { pathname: string }
}

export function LoginPage() {
  const { status, login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const [mode, setMode] = useState<'signIn' | 'resetPassword'>('signIn')
  const [resetEmail, setResetEmail] = useState('')
  const [resetSubmitting, setResetSubmitting] = useState(false)
  const [resetMessage, setResetMessage] = useState<string | null>(null)

  if (!hasFirebaseConfig()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <Card className="w-full max-w-md">
          <div className="flex flex-col items-center gap-3 pb-4 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600">
              <Ambulance className="h-6 w-6 text-white" aria-hidden="true" />
            </span>
            <h1 className="text-xl font-bold text-slate-900">Unified NEMT Operations Hub</h1>
            <p className="text-sm text-slate-500">
              Authentication is unavailable because Firebase is not configured. Copy `.env.example` to `.env` and add your Firebase web app credentials to enable staff sign-in.
            </p>
          </div>
          <Button variant="secondary" className="w-full" onClick={() => navigate('/dashboard')}>
            Continue to preview
          </Button>
        </Card>
      </div>
    )
  }

  if (status === 'loading') return <FullScreenLoader label="Checking your session…" />

  if (status === 'authenticated') {
    const from = (location.state as LocationState | undefined)?.from?.pathname ?? '/dashboard'
    return <Navigate to={from} replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (!email.trim() || !password) {
      setError('Please enter both email and password.')
      return
    }
    setSubmitting(true)
    try {
      await login(email, password)
      const from = (location.state as LocationState | undefined)?.from?.pathname ?? '/dashboard'
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResetSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setResetMessage(null)
    if (!resetEmail.trim()) return
    setResetSubmitting(true)
    try {
      await sendPasswordReset(resetEmail)
    } catch {
      // Deliberately swallowed -- see sendPasswordReset's own comment. The
      // same confirmation shows whether or not that email has an account,
      // so this screen can't be used to enumerate registered users.
    } finally {
      setResetSubmitting(false)
      setResetMessage(`If an account exists for ${resetEmail.trim()}, a reset link has been sent.`)
    }
  }

  function backToSignIn() {
    setMode('signIn')
    setResetEmail('')
    setResetMessage(null)
  }

  if (mode === 'resetPassword') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
        <Card className="w-full max-w-md">
          <div className="flex flex-col items-center gap-3 pb-4 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600">
              <Ambulance className="h-6 w-6 text-white" aria-hidden="true" />
            </span>
            <h1 className="text-xl font-bold text-slate-900">Reset your password</h1>
            <p className="text-sm text-slate-500">Enter your email and we'll send you a reset link.</p>
          </div>
          {resetMessage ? (
            <div className="space-y-4">
              <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">{resetMessage}</p>
              <Button variant="secondary" className="w-full" onClick={backToSignIn}>
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back to sign in
              </Button>
            </div>
          ) : (
            <form onSubmit={handleResetSubmit} className="space-y-4">
              <div>
                <label htmlFor="reset-email" className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                <input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={resetEmail}
                  onChange={(event) => setResetEmail(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                  placeholder="you@company.com"
                />
              </div>
              <Button type="submit" className="w-full" loading={resetSubmitting}>
                Send reset link
              </Button>
              <button
                type="button"
                onClick={backToSignIn}
                className="flex w-full items-center justify-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Back to sign in
              </button>
            </form>
          )}
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <Card className="w-full max-w-md">
        <div className="flex flex-col items-center gap-3 pb-4 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600">
            <Ambulance className="h-6 w-6 text-white" aria-hidden="true" />
          </span>
          <h1 className="text-xl font-bold text-slate-900">Unified NEMT Operations Hub</h1>
          <p className="text-sm text-slate-500">Sign in to continue</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
              placeholder="you@company.com"
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">Password</label>
              <button
                type="button"
                onClick={() => setMode('resetPassword')}
                className="text-xs font-medium text-blue-600 hover:underline"
              >
                Forgot password?
              </button>
            </div>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
              placeholder="••••••••"
            />
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" loading={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
            <LogIn className="h-4 w-4" aria-hidden="true" />
          </Button>
        </form>
      </Card>
    </div>
  )
}