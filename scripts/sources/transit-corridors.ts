import type { Feature, LineString } from 'geojson'
import { parseCsv, fetchGtfsZip, parseShapes } from './_gtfs'

export type CorridorMode = 'bart' | 'muni-metro' | 'caltrain' | 'rapid-bus'

export interface CorridorFeature extends Feature<LineString, { mode: CorridorMode; line_name: string }> {}

interface Bbox { west: number; east: number; south: number; north: number }

const SF_BBOX: Bbox = { west: -122.515, east: -122.355, south: 37.706, north: 37.81 }
const BART_GTFS_URL = 'https://www.bart.gov/dev/schedules/google_transit.zip'
const RAIL_SHORT_NAMES = new Set(['K', 'L', 'M', 'N', 'T', 'J'])

function pointInBbox(lng: number, lat: number, b: Bbox): boolean {
  return lng >= b.west && lng <= b.east && lat >= b.south && lat <= b.north
}

/** Split a polyline into contiguous segments that lie within the bbox. */
export function clipLineToBbox(coords: [number, number][], bbox: Bbox): [number, number][][] {
  const segments: [number, number][][] = []
  let current: [number, number][] = []
  for (const [lng, lat] of coords) {
    if (pointInBbox(lng, lat, bbox)) {
      current.push([lng, lat])
    } else if (current.length > 0) {
      segments.push(current)
      current = []
    }
  }
  if (current.length > 0) segments.push(current)
  return segments
}

/** Build BART corridor features from a parsed shapes map. */
export function simplifyAndBuildBartFeatures(
  shapes: Map<string, [number, number][]>,
): CorridorFeature[] {
  const out: CorridorFeature[] = []
  for (const [shapeId, coords] of shapes) {
    if (coords.length < 1) continue
    out.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: coords },
      properties: { mode: 'bart', line_name: `BART · ${shapeId}` },
    })
  }
  return out
}

/** Classify a Muni route short_name into a corridor mode (or null = skip). */
export function classifyMuniShape(shortName: string): CorridorMode | null {
  if (RAIL_SHORT_NAMES.has(shortName)) return 'muni-metro'
  if (/R$/.test(shortName)) return 'rapid-bus'
  return null
}

interface MuniTrip { trip_id: string; route_id: string; shape_id: string }
interface MuniRoute { route_id: string; route_short_name: string }

export function buildMuniFeatures(
  shapes: Map<string, [number, number][]>,
  trips: MuniTrip[],
  routes: MuniRoute[],
): CorridorFeature[] {
  const routeNameById = new Map(routes.map((r) => [r.route_id, r.route_short_name]))
  // Pick one classifying route per shape. First matching trip wins.
  const shapeToRouteName = new Map<string, string>()
  for (const t of trips) {
    if (shapeToRouteName.has(t.shape_id)) continue
    const short = routeNameById.get(t.route_id)
    if (!short) continue
    if (!classifyMuniShape(short)) continue
    shapeToRouteName.set(t.shape_id, short)
  }
  const out: CorridorFeature[] = []
  for (const [shapeId, shortName] of shapeToRouteName) {
    const coords = shapes.get(shapeId)
    if (!coords || coords.length < 1) continue
    const mode = classifyMuniShape(shortName)
    if (!mode) continue
    out.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: coords },
      properties: { mode, line_name: `Muni · ${shortName}` },
    })
  }
  return out
}

/** Fetch BART GTFS, parse shapes, return CorridorFeatures. */
export async function fetchBartCorridors(): Promise<CorridorFeature[]> {
  const entries = await fetchGtfsZip(BART_GTFS_URL, ['shapes.txt'])
  const rows = entries['shapes.txt']
  const header = ['shape_id', 'shape_pt_lat', 'shape_pt_lon', 'shape_pt_sequence']
  const csv = [header.join(','), ...rows.map((r) => header.map((h) => r[h] ?? '').join(','))].join('\n')
  const shapes = parseShapes(csv)
  return simplifyAndBuildBartFeatures(shapes)
}

/** Fetch SFMTA GTFS via 511, return classified Muni Metro + rapid-bus corridors. */
export async function fetchMuniCorridors(): Promise<CorridorFeature[]> {
  const key = process.env.FIVE_ELEVEN_API_KEY
  if (!key) {
    console.warn('FIVE_ELEVEN_API_KEY not set; skipping Muni corridors')
    return []
  }
  const url = `https://api.511.org/transit/datafeeds?operator_id=SF&api_key=${encodeURIComponent(key)}`
  const entries = await fetchGtfsZip(url, ['shapes.txt', 'trips.txt', 'routes.txt'])

  const toCsv = (rows: Record<string, string>[], header: string[]): string =>
    [header.join(','), ...rows.map((r) => header.map((h) => r[h] ?? '').join(','))].join('\n')

  const shapes = parseShapes(toCsv(entries['shapes.txt'], ['shape_id', 'shape_pt_lat', 'shape_pt_lon', 'shape_pt_sequence']))
  const trips = parseCsv(toCsv(entries['trips.txt'], ['trip_id', 'route_id', 'shape_id'])) as unknown as MuniTrip[]
  const routes = parseCsv(toCsv(entries['routes.txt'], ['route_id', 'route_short_name'])) as unknown as MuniRoute[]
  return buildMuniFeatures(shapes, trips, routes)
}

/** Fetch Caltrain GTFS via 511, parse shapes, clip to SF county. */
export async function fetchCaltrainCorridors(): Promise<CorridorFeature[]> {
  const key = process.env.FIVE_ELEVEN_API_KEY
  if (!key) {
    console.warn('FIVE_ELEVEN_API_KEY not set; skipping Caltrain corridors')
    return []
  }
  const url = `https://api.511.org/transit/datafeeds?operator_id=CT&api_key=${encodeURIComponent(key)}`
  const entries = await fetchGtfsZip(url, ['shapes.txt'])
  const rows = entries['shapes.txt']
  const header = ['shape_id', 'shape_pt_lat', 'shape_pt_lon', 'shape_pt_sequence']
  const csv = [header.join(','), ...rows.map((r) => header.map((h) => r[h] ?? '').join(','))].join('\n')
  const shapes = parseShapes(csv)

  const out: CorridorFeature[] = []
  for (const [shapeId, coords] of shapes) {
    const segments = clipLineToBbox(coords, SF_BBOX)
    for (let i = 0; i < segments.length; i++) {
      out.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: segments[i] },
        properties: {
          mode: 'caltrain',
          line_name: `Caltrain · ${shapeId}${segments.length > 1 ? ` (seg ${i + 1})` : ''}`,
        },
      })
    }
  }
  return out
}
