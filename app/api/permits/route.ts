import { fetchBuildingPermits } from '@/lib/datasf'
import type { MapBounds } from '@/lib/types'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const north = searchParams.get('north')
  const south = searchParams.get('south')
  const east = searchParams.get('east')
  const west = searchParams.get('west')

  let bounds: MapBounds | undefined
  const anyPresent = north !== null || south !== null || east !== null || west !== null
  const allPresent = north !== null && south !== null && east !== null && west !== null
  if (allPresent) {
    const n = Number(north)
    const s = Number(south)
    const e = Number(east)
    const w = Number(west)
    if ([n, s, e, w].every(Number.isFinite)) {
      bounds = { north: n, south: s, east: e, west: w }
    } else {
      return Response.json({ error: 'Invalid bounds' }, { status: 400 })
    }
  } else if (anyPresent) {
    // Partial bounds: ignore and call without bounds (preserves existing behavior).
  }

  try {
    const permits = bounds ? await fetchBuildingPermits(bounds) : await fetchBuildingPermits()
    return Response.json(permits)
  } catch (err) {
    console.error(err)
    return Response.json({ error: 'Failed to fetch permits' }, { status: 500 })
  }
}
