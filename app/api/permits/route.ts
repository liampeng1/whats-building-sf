import { fetchBuildingPermits } from '@/lib/datasf'
import type { MapBounds } from '@/lib/types'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const north = searchParams.get('north')
  const south = searchParams.get('south')
  const east = searchParams.get('east')
  const west = searchParams.get('west')

  let bounds: MapBounds | undefined
  if (north && south && east && west) {
    bounds = {
      north: Number(north),
      south: Number(south),
      east: Number(east),
      west: Number(west),
    }
  }

  try {
    const permits = bounds ? await fetchBuildingPermits(bounds) : await fetchBuildingPermits()
    return Response.json(permits)
  } catch {
    return Response.json({ error: 'Failed to fetch permits' }, { status: 500 })
  }
}
