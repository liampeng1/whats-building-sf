import type { RailStation } from '../../lib/transit-stations'

const MERGE_THRESHOLD_M = 50

function distanceMeters(a: RailStation, b: RailStation): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Collapse stations within MERGE_THRESHOLD_M of an already-kept station,
 *  merging their `modes` arrays. First-seen wins on id and name. */
export function mergeRailStations(input: RailStation[]): RailStation[] {
  const out: RailStation[] = []
  for (const s of input) {
    const near = out.find((o) => distanceMeters(o, s) < MERGE_THRESHOLD_M)
    if (near) {
      near.modes = [...new Set([...near.modes, ...s.modes])]
      continue
    }
    out.push({ ...s, modes: [...s.modes] })
  }
  return out
}
