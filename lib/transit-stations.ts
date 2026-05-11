/**
 * Transit-adjacency helpers. Stations are loaded at runtime from
 * /rail-stations.json and /rapid-bus-stops.json — both emitted by
 * scripts/build-cross-stats.ts from real datasets (BART GTFS via
 * bart.gov, SFMTA + Caltrain via 511.org regional feed).
 *
 * SSR-safe: top-level arrays are empty until hydrated. Call
 * loadStations() once on the client after mount.
 */

export interface RailStation {
  id: string
  name: string
  lat: number
  lng: number
  modes: ('bart' | 'muni-metro' | 'caltrain')[]
}

export interface RapidBusStop {
  id: string
  name: string
  lat: number
  lng: number
  routes: string[]
}

// `let` so loadStations() can replace contents; the arrays themselves
// keep their reference identity (we splice into them) so consumers that
// stash a reference still see the populated data.
export const RAIL_STATIONS: RailStation[] = []
export const RAPID_BUS_STOPS: RapidBusStop[] = []

let hydrated = false
export async function loadStations(baseUrl = ''): Promise<void> {
  if (hydrated) return
  hydrated = true
  try {
    const [rail, rapid] = await Promise.all([
      fetch(`${baseUrl}/rail-stations.json`).then((r) => (r.ok ? r.json() : [])),
      fetch(`${baseUrl}/rapid-bus-stops.json`).then((r) => (r.ok ? r.json() : [])),
    ])
    RAIL_STATIONS.length = 0
    RAIL_STATIONS.push(...(rail as RailStation[]))
    RAPID_BUS_STOPS.length = 0
    RAPID_BUS_STOPS.push(...(rapid as RapidBusStop[]))
  } catch {
    // Leave arrays empty; the UI degrades gracefully.
  }
}

/** Haversine. Accurate to a few cm at SF scales. */
export function distanceMeters(
  lat1: number, lng1: number, lat2: number, lng2: number,
): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export const RAIL_THRESHOLD_M = 400        // ¼ mi
export const RAPID_BUS_THRESHOLD_M = 160  // 0.1 mi

export function railShed(
  coords: [number, number] | null | undefined,
  threshold = RAIL_THRESHOLD_M,
): boolean {
  if (!coords) return false
  const [lng, lat] = coords
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
  for (const s of RAIL_STATIONS) {
    if (distanceMeters(lat, lng, s.lat, s.lng) <= threshold) return true
  }
  return false
}

export function rapidBusShed(
  coords: [number, number] | null | undefined,
  threshold = RAPID_BUS_THRESHOLD_M,
): boolean {
  if (!coords) return false
  const [lng, lat] = coords
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
  for (const s of RAPID_BUS_STOPS) {
    if (distanceMeters(lat, lng, s.lat, s.lng) <= threshold) return true
  }
  return false
}

export function transitAdjacent(
  coords: [number, number] | null | undefined,
  opts: {
    rail?: boolean
    rapidBus?: boolean
    railThresholdM?: number
    rapidBusThresholdM?: number
  } = {},
): boolean {
  const rail = opts.rail ?? true
  const rapidBus = opts.rapidBus ?? false
  if (rail && railShed(coords, opts.railThresholdM)) return true
  if (rapidBus && rapidBusShed(coords, opts.rapidBusThresholdM)) return true
  return false
}

/** Used by the per-station click filter in Phase 2. */
export function withinStationRadius(
  coords: [number, number] | null | undefined,
  station: { lat: number; lng: number },
  radiusM: number,
): boolean {
  if (!coords) return false
  const [lng, lat] = coords
  return distanceMeters(lat, lng, station.lat, station.lng) <= radiusM
}
