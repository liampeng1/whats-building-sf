import { parseCsv, fetchGtfsZip } from './_gtfs'
import { slugify } from './_utils'
import type { RailStation, RapidBusStop, FrequentLocalStop } from '../../lib/transit-stations'
import { FREQUENT_LOCAL_LINES } from '../../lib/transit-stations'

interface GtfsStop { stop_id: string; stop_name: string; stop_lat: string; stop_lon: string; location_type?: string }
interface GtfsRoute { route_id: string; route_short_name: string; route_type?: string }
interface GtfsTrip { route_id: string; trip_id: string; service_id?: string }
interface GtfsStopTime { trip_id: string; stop_id: string; departure_time?: string }

export interface ParsedGtfs {
  stops: GtfsStop[]
  routes: GtfsRoute[]
  trips: GtfsTrip[]
  stop_times: GtfsStopTime[]
}

const RAIL_SHORT_NAMES = new Set(['K', 'L', 'M', 'N', 'T', 'J'])

/** Parse a bundle of GTFS file strings into typed arrays. Each `_` parameter
 *  is the raw text of the corresponding .txt file. */
export function parseGtfsFiles(files: {
  stops: string
  routes: string
  trips: string
  stop_times: string
}): ParsedGtfs {
  return {
    stops: parseCsv(files.stops) as unknown as GtfsStop[],
    routes: parseCsv(files.routes) as unknown as GtfsRoute[],
    trips: parseCsv(files.trips) as unknown as GtfsTrip[],
    stop_times: parseCsv(files.stop_times) as unknown as GtfsStopTime[],
  }
}

export function selectRailRouteIds(routes: GtfsRoute[]): string[] {
  return routes.filter((r) => RAIL_SHORT_NAMES.has(r.route_short_name)).map((r) => r.route_id)
}

export function selectRapidBusRouteIds(routes: GtfsRoute[]): string[] {
  return routes.filter((r) => /R$/.test(r.route_short_name)).map((r) => r.route_id)
}

/** Select GTFS route ids for the SFMTA Frequent Transit Network local lines
 *  (≥ 6 trips/hr AM peak, per FREQUENT_LOCAL_LINES). */
export function selectFrequentLocalRouteIds(routes: GtfsRoute[]): string[] {
  const target = new Set<string>(FREQUENT_LOCAL_LINES as readonly string[])
  return routes.filter((r) => target.has(r.route_short_name)).map((r) => r.route_id)
}

/** Build stop_id → Set<route_id> by chaining stop_times → trips → route_id. */
export function buildStopRouteMap(
  stopTimes: GtfsStopTime[],
  trips: GtfsTrip[],
): Map<string, Set<string>> {
  const tripToRoute = new Map<string, string>()
  for (const t of trips) tripToRoute.set(t.trip_id, t.route_id)
  const stopToRoutes = new Map<string, Set<string>>()
  for (const st of stopTimes) {
    const routeId = tripToRoute.get(st.trip_id)
    if (!routeId) continue
    if (!stopToRoutes.has(st.stop_id)) stopToRoutes.set(st.stop_id, new Set())
    stopToRoutes.get(st.stop_id)!.add(routeId)
  }
  return stopToRoutes
}

function isValidStopRow(s: GtfsStop): boolean {
  if (!s.stop_name?.trim()) return false
  if (s.location_type !== '' && s.location_type !== undefined && s.location_type !== '0') return false
  const lat = Number(s.stop_lat)
  const lng = Number(s.stop_lon)
  return Number.isFinite(lat) && Number.isFinite(lng)
}

export function buildRailStations(
  stops: GtfsStop[],
  stopToRoutes: Map<string, Set<string>>,
  railRouteIds: Set<string>,
): RailStation[] {
  return stops
    .filter(isValidStopRow)
    .filter((s) => {
      const routes = stopToRoutes.get(s.stop_id)
      if (!routes) return false
      for (const id of routes) if (railRouteIds.has(id)) return true
      return false
    })
    .map((s) => ({
      id: `muni-${s.stop_id}-${slugify(s.stop_name)}`,
      name: s.stop_name,
      lat: Number(s.stop_lat),
      lng: Number(s.stop_lon),
      modes: ['muni-metro'] as ('bart' | 'muni-metro' | 'caltrain')[],
    }))
}

export function buildRapidBusStops(
  stops: GtfsStop[],
  routes: GtfsRoute[],
  stopToRoutes: Map<string, Set<string>>,
  rapidIds: Set<string>,
): RapidBusStop[] {
  const idToShort = new Map(routes.map((r) => [r.route_id, r.route_short_name]))
  return stops
    .filter(isValidStopRow)
    .filter((s) => {
      const r = stopToRoutes.get(s.stop_id)
      if (!r) return false
      for (const id of r) if (rapidIds.has(id)) return true
      return false
    })
    .map((s) => {
      const ids = stopToRoutes.get(s.stop_id)!
      const shortNames: string[] = []
      for (const id of ids) {
        if (rapidIds.has(id)) {
          const sn = idToShort.get(id)
          if (sn) shortNames.push(sn)
        }
      }
      return {
        id: `bus-${s.stop_id}-${slugify(s.stop_name)}`,
        name: s.stop_name,
        lat: Number(s.stop_lat),
        lng: Number(s.stop_lon),
        routes: [...new Set(shortNames)],
      }
    })
}

export function buildFrequentLocalStops(
  stops: GtfsStop[],
  routes: GtfsRoute[],
  stopToRoutes: Map<string, Set<string>>,
  localIds: Set<string>,
): FrequentLocalStop[] {
  const idToShort = new Map(routes.map((r) => [r.route_id, r.route_short_name]))
  return stops
    .filter(isValidStopRow)
    .filter((s) => {
      const r = stopToRoutes.get(s.stop_id)
      if (!r) return false
      for (const id of r) if (localIds.has(id)) return true
      return false
    })
    .map((s) => {
      const ids = stopToRoutes.get(s.stop_id)!
      const shortNames: string[] = []
      for (const id of ids) {
        if (localIds.has(id)) {
          const sn = idToShort.get(id)
          if (sn) shortNames.push(sn)
        }
      }
      return {
        id: `local-${s.stop_id}-${slugify(s.stop_name)}`,
        name: s.stop_name,
        lat: Number(s.stop_lat),
        lng: Number(s.stop_lon),
        routes: [...new Set(shortNames)],
      }
    })
}

/** Parsed SFMTA feed plus the calendar tables needed for frequency analysis.
 *  calendar/calendarDates are raw GTFS rows (consumed by muni-frequency). */
export interface MuniGtfs {
  gtfs: ParsedGtfs
  calendar: Record<string, string>[]
  calendarDates: Record<string, string>[]
}

/** Single network pull of the SFMTA GTFS feed. Returns null when the API key
 *  is unset so the build can degrade gracefully. Fetched once and shared by
 *  both the station builders and the frequency builder to avoid re-downloading
 *  the (large) stop_times feed twice. */
export async function fetchMuniGtfs(): Promise<MuniGtfs | null> {
  const key = process.env.FIVE_ELEVEN_API_KEY
  if (!key) {
    console.warn('FIVE_ELEVEN_API_KEY not set; skipping Muni stations')
    return null
  }
  const url = `https://api.511.org/transit/datafeeds?operator_id=SF&api_key=${encodeURIComponent(key)}`
  const entries = await fetchGtfsZip(url, [
    'stops.txt', 'routes.txt', 'trips.txt', 'stop_times.txt', 'calendar.txt', 'calendar_dates.txt',
  ])

  // Re-serialize parsed records back to CSV text so parseGtfsFiles drives
  // both the production path and tests off the same shape.
  function toCsv(rows: Record<string, string>[], header: string[]): string {
    return [header.join(','), ...rows.map((r) => header.map((h) => r[h] ?? '').join(','))].join('\n')
  }

  const gtfs = parseGtfsFiles({
    stops: toCsv(entries['stops.txt'], ['stop_id', 'stop_name', 'stop_lat', 'stop_lon', 'location_type']),
    routes: toCsv(entries['routes.txt'], ['route_id', 'route_short_name', 'route_type']),
    trips: toCsv(entries['trips.txt'], ['route_id', 'trip_id', 'service_id']),
    stop_times: toCsv(entries['stop_times.txt'], ['trip_id', 'stop_id', 'departure_time']),
  })

  return { gtfs, calendar: entries['calendar.txt'], calendarDates: entries['calendar_dates.txt'] }
}

/** Derive rail + rapid + frequent-local stops from an already-parsed feed. */
export function buildMuniFromGtfs(gtfs: ParsedGtfs): {
  rail: RailStation[]
  rapid: RapidBusStop[]
  local: FrequentLocalStop[]
} {
  const stopMap = buildStopRouteMap(gtfs.stop_times, gtfs.trips)
  const railIds = new Set(selectRailRouteIds(gtfs.routes))
  const rapidIds = new Set(selectRapidBusRouteIds(gtfs.routes))
  const localIds = new Set(selectFrequentLocalRouteIds(gtfs.routes))
  return {
    rail: buildRailStations(gtfs.stops, stopMap, railIds),
    rapid: buildRapidBusStops(gtfs.stops, gtfs.routes, stopMap, rapidIds),
    local: buildFrequentLocalStops(gtfs.stops, gtfs.routes, stopMap, localIds),
  }
}

/** Top-level async fetch: pulls SFMTA GTFS via 511 and returns rail + rapid + local. */
export async function fetchMuni(): Promise<{
  rail: RailStation[]
  rapid: RapidBusStop[]
  local: FrequentLocalStop[]
}> {
  const m = await fetchMuniGtfs()
  if (!m) return { rail: [], rapid: [], local: [] }
  return buildMuniFromGtfs(m.gtfs)
}
