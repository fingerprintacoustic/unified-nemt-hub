import { loadGoogleMaps } from '../lib/googleMaps'

export interface GeocodeResult {
  lat: number
  lng: number
  formattedAddress: string
}

/**
 * Resolves a free-text address to coordinates via the Google Maps Geocoder.
 * Rejects (never returns a fabricated/placeholder coordinate) if the address
 * can't be resolved or Google Maps isn't configured — callers should surface
 * the error rather than writing a guessed GeoPoint.
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const trimmed = address.trim()
  if (!trimmed) throw new Error('Enter an address to geocode.')

  await loadGoogleMaps()
  const geocoder = new window.google!.maps.Geocoder()

  return new Promise((resolve, reject) => {
    geocoder.geocode({ address: trimmed }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        const location = results[0].geometry.location
        resolve({
          lat: location.lat(),
          lng: location.lng(),
          formattedAddress: results[0].formatted_address,
        })
        return
      }
      if (status === 'ZERO_RESULTS') {
        reject(new Error(`Could not find that address: "${trimmed}"`))
        return
      }
      reject(new Error(`Geocoding failed (${status}) for "${trimmed}"`))
    })
  })
}
