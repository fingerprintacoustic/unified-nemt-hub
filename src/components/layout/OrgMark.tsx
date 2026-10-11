import { Ambulance } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

interface OrgMarkProps {
  /** Tile size classes, e.g. "h-9 w-9". */
  size: string
  iconSize: string
}

/** The organization's logo if it has one (on a white tile so any logo colors
 * stay readable on the dark header), otherwise the default app icon. */
export function OrgMark({ size, iconSize }: OrgMarkProps) {
  const { organization } = useAuth()
  const logo = organization?.logoDataUrl

  if (logo) {
    return (
      <span className={`flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-1`}>
        <img src={logo} alt="" className="max-h-full max-w-full object-contain" />
      </span>
    )
  }
  return (
    <span className={`flex ${size} shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white`}>
      <Ambulance className={iconSize} aria-hidden="true" />
    </span>
  )
}
