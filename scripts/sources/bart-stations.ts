import { fetchGtfsZip, parseCsv } from './_gtfs'
import { slugify } from './_utils'
import type { RailStation } from '../../lib/transit-stations'

const BART_GTFS_URL = 'https://www.bart.gov/dev/schedules/google_transit.zip'

/** SF county + Daly City. Tight enough to exclude Oakland/Berkeley, loose
 * enough to include the southern edge stations residents rely on. */
export const BART_SF_BBOX = {
  south: 37.706,
  north: 37.81,
  west: -122.515,
  east: -122.355,
}

export function parseBartStops(csv: string): RailStation[] {
  const rows = parseCsv(csv)
  return rows
    .filter((r) => (r.stop_name ?? '').trim().length > 0)
    .filter((r) => (r.location_type ?? '') === '' || r.location_type === '0')
    .map((r) => ({
      id: `bart-${slugify(r.stop_name)}`,
      name: r.stop_name,
      lat: Number(r.stop_lat),
      lng: Number(r.stop_lon),
      modes: ['bart'] as RailStation['modes'],
    }))
    .filter(
      (s) =>
        Number.isFinite(s.lat) &&
        Number.isFinite(s.lng) &&
        s.lat >= BART_SF_BBOX.south &&
        s.lat <= BART_SF_BBOX.north &&
        s.lng >= BART_SF_BBOX.west &&
        s.lng <= BART_SF_BBOX.east,
    )
}

export async function fetchBartStations(): Promise<RailStation[]> {
  const entries = await fetchGtfsZip(BART_GTFS_URL, ['stops.txt'])
  // Re-serialize the parsed records to CSV-shaped text so parseBartStops
  // can be tested in isolation against fixtures.
  const rows = entries['stops.txt']
  const header = ['stop_id', 'stop_name', 'stop_lat', 'stop_lon', 'location_type']
  const lines = [header.join(',')]
  for (const r of rows) lines.push(header.map((h) => r[h] ?? '').join(','))
  return parseBartStops(lines.join('\n'))
}
