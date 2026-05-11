import { fetchGtfsZip, parseCsv } from './_gtfs'
import { slugify } from './_utils'
import type { RailStation } from '../../lib/transit-stations'

const CALTRAIN_GTFS_URL = (key: string) =>
  `https://api.511.org/transit/datafeeds?operator_id=CT&api_key=${encodeURIComponent(key)}`

export const CALTRAIN_SF_STOP_IDS = new Set(['70011', '70021', '70031'])

export function parseCaltrainStops(csv: string): RailStation[] {
  const rows = parseCsv(csv)
  return rows
    .filter((r) => CALTRAIN_SF_STOP_IDS.has(r.stop_id))
    .filter((r) => (r.stop_name ?? '').trim().length > 0)
    .map((r) => ({
      id: `caltrain-${slugify(r.stop_name)}`,
      name: r.stop_name,
      lat: Number(r.stop_lat),
      lng: Number(r.stop_lon),
      modes: ['caltrain'] as ('bart' | 'muni-metro' | 'caltrain')[],
    }))
    .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
}

export async function fetchCaltrainSfStations(): Promise<RailStation[]> {
  const key = process.env.FIVE_ELEVEN_API_KEY
  if (!key) {
    console.warn('FIVE_ELEVEN_API_KEY not set; skipping Caltrain stations')
    return []
  }
  const entries = await fetchGtfsZip(CALTRAIN_GTFS_URL(key), ['stops.txt'])
  const rows = entries['stops.txt']
  const header = ['stop_id', 'stop_name', 'stop_lat', 'stop_lon']
  const csv = [header.join(','), ...rows.map((r) => header.map((h) => r[h] ?? '').join(','))].join('\n')
  return parseCaltrainStops(csv)
}
