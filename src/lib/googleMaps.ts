/**
 * Loads the Google Maps JavaScript API once (for its Geocoder). Called
 * directly from the browser with a client-side API key restricted, on the
 * Google Cloud side, by HTTP referrer — the same pattern Firebase's own web
 * API key uses. No server proxy: see PROJECT_STATUS.md for that trade-off.
 */
import { googleMapsApiKey, hasGoogleMapsConfig } from '../config/env'

const CALLBACK_NAME = '__nemtHubInitGoogleMaps'

let loadPromise: Promise<void> | null = null

declare global {
  interface Window {
    __nemtHubInitGoogleMaps?: () => void
  }
}

export function loadGoogleMaps(): Promise<void> {
  if (!hasGoogleMapsConfig()) {
    return Promise.reject(
      new Error('Google Maps is not configured (VITE_GOOGLE_MAPS_API_KEY is not set).'),
    )
  }
  if (window.google?.maps) return Promise.resolve()
  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve, reject) => {
    window[CALLBACK_NAME] = () => resolve()
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      googleMapsApiKey,
    )}&callback=${CALLBACK_NAME}`
    script.async = true
    script.onerror = () => {
      loadPromise = null
      reject(new Error('Failed to load the Google Maps script.'))
    }
    document.head.appendChild(script)
  })
  return loadPromise
}
