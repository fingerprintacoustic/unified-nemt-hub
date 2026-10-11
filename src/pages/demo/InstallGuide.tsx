import { useState } from 'react'
import { Check, Copy, EllipsisVertical, Share, SquarePlus } from 'lucide-react'
import type { ReactNode } from 'react'

function Steps({ title, note, steps }: { title: string; note: string; steps: ReactNode[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-base font-bold text-slate-900">{title}</p>
      <p className="text-xs text-slate-500">{note}</p>
      <ol className="mt-4 space-y-3">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3 text-sm leading-6 text-slate-700">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
              {i + 1}
            </span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

const chip = 'mx-0.5 inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 align-middle text-xs font-semibold text-slate-700'

export function InstallGuide() {
  const [copied, setCopied] = useState<'ok' | 'blocked' | null>(null)
  const address = `${window.location.origin}/driver`

  async function copy() {
    try {
      await navigator.clipboard.writeText(address)
      setCopied('ok')
    } catch {
      setCopied('blocked')
    }
    setTimeout(() => setCopied(null), 2500)
  }

  return (
    <div id="install" className="mt-3 scroll-mt-16">
      <p className="max-w-3xl text-sm text-slate-600">
        The driver app is not downloaded from an app store. You open its address on the phone and add it to the home screen. After that it
        opens full screen, with its own icon, like any other app. It takes about a minute.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Address to open on the phone</span>
        <code className="rounded-md bg-slate-100 px-2 py-1 text-sm text-slate-800">{address}</code>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
        >
          {copied === 'ok' ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
          {copied === 'ok' ? 'Copied' : copied === 'blocked' ? 'Select the address to copy it' : 'Copy address'}
        </button>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Steps
          title="iPhone (Safari)"
          note="It has to be Safari. Other browsers on iPhone cannot add apps to the home screen."
          steps={[
            <>Open the address above in <b>Safari</b> and sign in, so you can see <b>My Trips</b>.</>,
            <>
              Tap the <b>Share</b> button
              <span className={chip}>
                <Share className="h-3.5 w-3.5" aria-hidden="true" />
                Share
              </span>
              at the bottom of the screen.
            </>,
            <>
              Scroll down and tap
              <span className={chip}>
                <SquarePlus className="h-3.5 w-3.5" aria-hidden="true" />
                Add to Home Screen
              </span>
              .
            </>,
            <>Tap <b>Add</b> in the top-right corner. The <b>NEMT Driver</b> icon is now on your home screen.</>,
          ]}
        />
        <Steps
          title="Android (Chrome)"
          note="Samsung Internet and other browsers have the same option in their menu."
          steps={[
            <>Open the address above in <b>Chrome</b> and sign in, so you can see <b>My Trips</b>.</>,
            <>
              Tap the menu button
              <span className={chip}>
                <EllipsisVertical className="h-3.5 w-3.5" aria-hidden="true" />
                Menu
              </span>
              in the top-right corner.
            </>,
            <>
              Tap <b>Install app</b>, or <b>Add to Home screen</b> if you do not see that.
            </>,
            <>Confirm. The <b>NEMT Driver</b> icon is now with your other apps.</>,
          ]}
        />
      </div>

      <ul className="mt-4 max-w-3xl list-disc space-y-1 pl-5 text-sm text-slate-600">
        <li>Open it from the icon and it fills the screen, with no browser bars.</li>
        <li>Each driver signs in with the login the company gives them, and only ever sees their own trips.</li>
        <li>The trips in this demo are sample data. The installed app is the real one, so it asks for a real login.</li>
      </ul>
    </div>
  )
}
