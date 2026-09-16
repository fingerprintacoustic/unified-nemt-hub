// Minimal ambient types for the one slice of the Google Maps JavaScript API
// this app uses (the Geocoder). Deliberately not the full @types/google.maps
// package, which covers a much larger surface than a single geocode() call.

export {}

declare global {
  namespace google.maps {
    interface LatLng {
      lat(): number
      lng(): number
    }

    interface GeocoderGeometry {
      location: LatLng
    }

    interface GeocoderResult {
      formatted_address: string
      geometry: GeocoderGeometry
    }

    type GeocoderStatus =
      | 'OK'
      | 'ZERO_RESULTS'
      | 'OVER_QUERY_LIMIT'
      | 'REQUEST_DENIED'
      | 'INVALID_REQUEST'
      | 'UNKNOWN_ERROR'
      | 'ERROR'

    interface GeocoderRequest {
      address?: string
    }

    class Geocoder {
      geocode(
        request: GeocoderRequest,
        callback: (results: GeocoderResult[] | null, status: GeocoderStatus) => void,
      ): void
    }
  }

  interface Window {
    google?: { maps: typeof google.maps }
  }
}
