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

export interface FrequentLocalStop {
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
export const FREQUENT_LOCAL_STOPS: FrequentLocalStop[] = []

let hydrated = false
export async function loadStations(baseUrl = ''): Promise<void> {
  if (hydrated) return
  hydrated = true
  try {
    const [rail, rapid, local] = await Promise.all([
      fetch(`${baseUrl}/rail-stations.json`).then((r) => (r.ok ? r.json() : [])),
      fetch(`${baseUrl}/rapid-bus-stops.json`).then((r) => (r.ok ? r.json() : [])),
      fetch(`${baseUrl}/frequent-local-stops.json`).then((r) => (r.ok ? r.json() : [])),
    ])
    RAIL_STATIONS.length = 0
    RAIL_STATIONS.push(...(rail as RailStation[]))
    RAPID_BUS_STOPS.length = 0
    RAPID_BUS_STOPS.push(...(rapid as RapidBusStop[]))
    FREQUENT_LOCAL_STOPS.length = 0
    FREQUENT_LOCAL_STOPS.push(...(local as FrequentLocalStop[]))
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

export type TransitTier = 'rail' | 'rapid-bus' | 'local-bus' | 'poor'

/**
 * SFMTA Frequent Transit Network — local Muni lines with ≥ 6 trips/hr
 * in the AM peak (per the most recent SFMTA FTN map). Stop coords are
 * loaded from /frequent-local-stops.json by loadStations().
 */
export const FREQUENT_LOCAL_LINES = ['1', '14', '22', '24', '30', '38', '49'] as const

const FREQUENT_LOCAL_THRESHOLD_M = 400 // ¼ mi

export function classifyTier(
  coords: [number, number] | null | undefined,
): TransitTier {
  if (!coords) return 'poor'
  if (railShed(coords, 400)) return 'rail'
  if (rapidBusShed(coords, 400)) return 'rapid-bus'
  const [lng, lat] = coords
  for (const s of FREQUENT_LOCAL_STOPS) {
    if (distanceMeters(lat, lng, s.lat, s.lng) <= FREQUENT_LOCAL_THRESHOLD_M) {
      return 'local-bus'
    }
  }
  return 'poor'
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
