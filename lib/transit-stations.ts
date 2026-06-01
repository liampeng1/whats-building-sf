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

/** GTFS-derived service class for a route. Rapid vs local is NOT encoded
 *  here — that is derivable from the route name and the frequency values. */
export type RouteMode = 'bus' | 'muni-metro' | 'cable-car'

/** One route serving a stop, with its weekday peak and off-peak frequency
 *  (trips per hour, departing this stop). 0 means it does not run in that
 *  window. Headway in minutes is 60 / tph. */
export interface RouteFreq {
  route: string
  mode: RouteMode
  peakTph: number
  offPeakTph: number
}

/** A boardable Muni stop with per-route frequency. Emitted to
 *  /muni-stop-frequency.json by scripts/build-cross-stats.ts. */
export interface FreqStop {
  id: string
  name: string
  lat: number
  lng: number
  routes: RouteFreq[]
}

// `let` so loadStations() can replace contents; the arrays themselves
// keep their reference identity (we splice into them) so consumers that
// stash a reference still see the populated data.
export const RAIL_STATIONS: RailStation[] = []
export const RAPID_BUS_STOPS: RapidBusStop[] = []
export const FREQUENT_LOCAL_STOPS: FrequentLocalStop[] = []
/** All boardable Muni stops with per-route peak/off-peak frequency. Drives
 *  the frequency-band tier model and the per-stop detail panel. */
export const FREQ_STOPS: FreqStop[] = []

let hydrated = false
export async function loadStations(baseUrl = ''): Promise<void> {
  if (hydrated) return
  hydrated = true
  try {
    const [rail, rapid, local, freq] = await Promise.all([
      fetch(`${baseUrl}/rail-stations.json`).then((r) => (r.ok ? r.json() : [])),
      fetch(`${baseUrl}/rapid-bus-stops.json`).then((r) => (r.ok ? r.json() : [])),
      fetch(`${baseUrl}/frequent-local-stops.json`).then((r) => (r.ok ? r.json() : [])),
      fetch(`${baseUrl}/muni-stop-frequency.json`).then((r) => (r.ok ? r.json() : [])),
    ])
    RAIL_STATIONS.length = 0
    RAIL_STATIONS.push(...(rail as RailStation[]))
    RAPID_BUS_STOPS.length = 0
    RAPID_BUS_STOPS.push(...(rapid as RapidBusStop[]))
    FREQUENT_LOCAL_STOPS.length = 0
    FREQUENT_LOCAL_STOPS.push(...(local as FrequentLocalStop[]))
    FREQ_STOPS.length = 0
    FREQ_STOPS.push(...(freq as FreqStop[]))
    markFreqStopsChanged()
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

export type TransitTier =
  | 'rail'
  | 'very-frequent-bus'
  | 'frequent-bus'
  | 'basic-bus'
  | 'poor'

/**
 * SFMTA Frequent Transit Network — local Muni lines with ≥ 6 trips/hr
 * in the AM peak (per the most recent SFMTA FTN map). Retained for the
 * legacy frequent-local-stops.json build; no longer used by classifyTier
 * (which now measures real frequency via FREQ_STOPS).
 */
export const FREQUENT_LOCAL_LINES = ['1', '14', '22', '24', '30', '38', '49'] as const

/** Combined peak trips/hour thresholds (sum of bus routes at a stop) that
 *  separate the three bus bands. ≥12 ≈ ≤5 min, ≥6 ≈ ≤10 min, ≥2 ≈ ≤30 min. */
export const VERY_FREQUENT_BUS_TPH = 12
export const FREQUENT_BUS_TPH = 6
export const BASIC_BUS_TPH = 2

/** Distance within which a stop counts toward a parcel's tier. */
const BUS_TIER_THRESHOLD_M = 400 // ¼ mi

/** Combined weekday peak frequency a stop offers, summed across its BUS
 *  routes only. Muni Metro is covered by the rail tier and cable cars are
 *  excluded, so neither contributes to the bus bands. This single function
 *  is the tunable modeling knob — swap the reducer for "best single route"
 *  here to change the metric everywhere. */
export function combinedBusPeakTph(stop: FreqStop): number {
  let sum = 0
  for (const r of stop.routes) if (r.mode === 'bus') sum += r.peakTph
  return sum
}

// ---- Spatial index over FREQ_STOPS -----------------------------------------
// A uniform grid sized to the tier threshold so a query only scans the 3×3
// block of cells around it. SF spans a narrow latitude range, so we size
// longitude cells with a fixed reference latitude.
const SF_REF_LAT = 37.76
const M_PER_DEG_LAT = 111_320
const M_PER_DEG_LNG = M_PER_DEG_LAT * Math.cos((SF_REF_LAT * Math.PI) / 180)

export interface FreqGrid {
  latStep: number
  lngStep: number
  byCell: Map<string, { lat: number; lng: number; tph: number }[]>
}

function cellKey(i: number, j: number): string {
  return `${i}:${j}`
}

/** Build a grid index of stops (with precomputed combined bus tph) sized so a
 *  `radiusM` query is covered by the 3×3 neighbor block. */
export function buildFreqGrid(stops: FreqStop[], radiusM: number): FreqGrid {
  const latStep = radiusM / M_PER_DEG_LAT
  const lngStep = radiusM / M_PER_DEG_LNG
  const byCell = new Map<string, { lat: number; lng: number; tph: number }[]>()
  for (const s of stops) {
    const tph = combinedBusPeakTph(s)
    if (tph === 0) continue
    const key = cellKey(Math.floor(s.lat / latStep), Math.floor(s.lng / lngStep))
    const bucket = byCell.get(key)
    if (bucket) bucket.push({ lat: s.lat, lng: s.lng, tph })
    else byCell.set(key, [{ lat: s.lat, lng: s.lng, tph }])
  }
  return { latStep, lngStep, byCell }
}

/** Max combined bus tph among grid stops within `radiusM` of the point. */
export function maxBusTphNear(grid: FreqGrid, lat: number, lng: number, radiusM: number): number {
  const ci = Math.floor(lat / grid.latStep)
  const cj = Math.floor(lng / grid.lngStep)
  let max = 0
  for (let i = ci - 1; i <= ci + 1; i++) {
    for (let j = cj - 1; j <= cj + 1; j++) {
      const bucket = grid.byCell.get(cellKey(i, j))
      if (!bucket) continue
      for (const s of bucket) {
        if (s.tph <= max) continue
        if (distanceMeters(lat, lng, s.lat, s.lng) <= radiusM) max = s.tph
      }
    }
  }
  return max
}

let freqGrid: FreqGrid | null = null
/** Invalidate the cached FREQ_STOPS grid. Called after hydration (and by
 *  tests that mutate FREQ_STOPS directly). */
export function markFreqStopsChanged(): void {
  freqGrid = null
}

function busBandFor(tph: number): TransitTier {
  if (tph >= VERY_FREQUENT_BUS_TPH) return 'very-frequent-bus'
  if (tph >= FREQUENT_BUS_TPH) return 'frequent-bus'
  if (tph >= BASIC_BUS_TPH) return 'basic-bus'
  return 'poor'
}

/** The frequency band a single stop falls into, by its combined bus tph.
 *  Used to color per-stop markers. 'poor' means < 2 tph of bus service. */
export function stopFreqBand(stop: FreqStop): TransitTier {
  return busBandFor(combinedBusPeakTph(stop))
}

export function classifyTier(
  coords: [number, number] | null | undefined,
): TransitTier {
  if (!coords) return 'poor'
  if (railShed(coords, BUS_TIER_THRESHOLD_M)) return 'rail'
  const [lng, lat] = coords
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return 'poor'
  if (!freqGrid) freqGrid = buildFreqGrid(FREQ_STOPS, BUS_TIER_THRESHOLD_M)
  return busBandFor(maxBusTphNear(freqGrid, lat, lng, BUS_TIER_THRESHOLD_M))
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
