import { Camera, ClipboardCheck, KeyRound, Navigation } from 'lucide-react'

export function DriverHelpPage() {
  return (
    <div className="space-y-4 pb-4">
      <div>
        <h1 className="text-lg font-bold text-slate-900">Help</h1>
        <p className="text-sm text-slate-500">How to use the driver app.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <ClipboardCheck className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <div className="space-y-1.5 text-sm leading-6 text-slate-600">
            <p className="font-semibold text-slate-800">Your trips</p>
            <p>
              <b>My Trips</b> shows only trips assigned to you, soonest first. Tap the button on a trip
              card to move it to the next step &mdash; Start trip, Picked up, Dropped off, then
              Completed. Finished trips move to your history below.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Navigation className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <div className="space-y-1.5 text-sm leading-6 text-slate-600">
            <p className="font-semibold text-slate-800">Navigation</p>
            <p>
              Tap <b>Navigate to pickup</b> or <b>Navigate to drop-off</b> on a trip card to open
              directions in your phone&rsquo;s own maps app.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Camera className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <div className="space-y-1.5 text-sm leading-6 text-slate-600">
            <p className="font-semibold text-slate-800">Inspections</p>
            <p>
              Submit a pre-trip or post-trip inspection any time from the <b>Inspections</b> tab &mdash;
              pick the vehicle, enter the odometer, rate the vehicle&rsquo;s condition, and add
              photos or video if needed.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <KeyRound className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <div className="space-y-1.5 text-sm leading-6 text-slate-600">
            <p className="font-semibold text-slate-800">Your account</p>
            <p>
              Sign out any time from the icon in the top-right corner. If you forget your password, use{' '}
              <b>Forgot password?</b> on the sign-in screen to get a reset link by email.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
