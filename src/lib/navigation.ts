import type { TripRecord } from '../types'

/**
 * Cross-platform maps deep link (Google's documented universal directions
 * URL) — opens the device's Google Maps app if installed, else falls back
 * to Google Maps in the browser. No API key needed; this isn't a Maps
 * Platform API call, just a URL.
 */
export function buildDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`
}

export interface NavigationTarget {
  lat: number
  lng: number
  label: string
}

/**
 * Where a driver currently needs directions to, based on trip status:
 * pickup before they've picked up the passenger, dropoff after. Returns
 * null once the trip is done (DROPPED_OFF/COMPLETED/CANCELLED/NO_SHOW) —
 * nothing left to navigate to.
 */
export function navigationTargetForTrip(trip: TripRecord): NavigationTarget | null {
  if (trip.status === 'PICKED_UP') {
    return {
      lat: trip.destination.latitude,
      lng: trip.destination.longitude,
      label: 'Navigate to dropoff',
    }
  }
  if (trip.status === 'SCHEDULED' || trip.status === 'ASSIGNED' || trip.status === 'EN_ROUTE') {
    return {
      lat: trip.origin.latitude,
      lng: trip.origin.longitude,
      label: 'Navigate to pickup',
    }
  }
  return null
}
