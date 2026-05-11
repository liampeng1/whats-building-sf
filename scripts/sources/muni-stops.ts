import { slugify } from './_utils'
import type { RailStation, RapidBusStop } from '../../lib/transit-stations'

interface MuniRoute {
  route_id: string
  lineabbr: string
  route_type: string
}
interface MuniStop {
  stopid: string
  stopname: string
  latitude: string
  longitude: string
  routes: string  // comma-separated route_ids
}

const RAIL_LINES = new Set(['K', 'L', 'M', 'N', 'T', 'J'])

export function selectRailRouteIds(routes: MuniRoute[]): string[] {
  return routes.filter((r) => RAIL_LINES.has(r.lineabbr)).map((r) => r.route_id)
}

export function selectRapidBusRouteIds(routes: MuniRoute[]): string[] {
  return routes.filter((r) => /R$/.test(r.lineabbr)).map((r) => r.route_id)
}

function isValidStopRow(s: MuniStop): boolean {
  if (!s.stopname?.trim()) return false
  const lat = Number(s.latitude)
  const lng = Number(s.longitude)
  return Number.isFinite(lat) && Number.isFinite(lng)
}

export function buildRailStations(stops: MuniStop[], railRouteIds: Set<string>): RailStation[] {
  return stops
    .filter(isValidStopRow)
    .filter((s) => s.routes.split(',').some((id) => railRouteIds.has(id.trim())))
    .map((s) => ({
      id: `muni-${slugify(s.stopname)}`,
      name: s.stopname,
      lat: Number(s.latitude),
      lng: Number(s.longitude),
      modes: ['muni-metro'] as ('bart' | 'muni-metro' | 'caltrain')[],
    }))
}

export function buildRapidBusStops(
  stops: MuniStop[],
  routes: MuniRoute[],
  rapidIds: Set<string>,
): RapidBusStop[] {
  const idToLine = new Map(routes.map((r) => [r.route_id, r.lineabbr]))
  return stops
    .filter(isValidStopRow)
    .filter((s) => s.routes.split(',').some((id) => rapidIds.has(id.trim())))
    .map((s) => {
      const lines = s.routes
        .split(',')
        .map((id) => id.trim())
        .filter((id) => rapidIds.has(id))
        .map((id) => idToLine.get(id)!)
      return {
        id: `bus-${slugify(s.stopname)}`,
        name: s.stopname,
        lat: Number(s.latitude),
        lng: Number(s.longitude),
        routes: [...new Set(lines)],
      }
    })
}

export async function fetchMuni(): Promise<{
  rail: RailStation[]
  rapid: RapidBusStop[]
}> {
  const headers: Record<string, string> = {}
  if (process.env.DATASF_APP_TOKEN) headers['X-App-Token'] = process.env.DATASF_APP_TOKEN
  const [rRoutes, rStops] = await Promise.all([
    fetch('https://data.sfgov.org/resource/9exe-acju.json?$limit=2000', { headers }),
    fetch('https://data.sfgov.org/resource/i28k-bkz6.json?$limit=10000', { headers }),
  ])
  if (!rRoutes.ok) throw new Error(`Muni routes fetch failed: ${rRoutes.status}`)
  if (!rStops.ok) throw new Error(`Muni stops fetch failed: ${rStops.status}`)
  const routes = (await rRoutes.json()) as MuniRoute[]
  const stops = (await rStops.json()) as MuniStop[]
  const railIds = new Set(selectRailRouteIds(routes))
  const rapidIds = new Set(selectRapidBusRouteIds(routes))
  return {
    rail: buildRailStations(stops, railIds),
    rapid: buildRapidBusStops(stops, routes, rapidIds),
  }
}
