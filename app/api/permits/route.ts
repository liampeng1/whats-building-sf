import { fetchBuildingPermits } from '@/lib/datasf'
import type { MapBounds } from '@/lib/types'

// Cache the route output for 6 hours. DataSF refreshes daily; 6h gives users
// a snappy experience while keeping data near-fresh. Vercel's fetch cache
// also dedupes the underlying DataSF calls across requests.
export const revalidate = 21600

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

  // Completed-window control. Pass ?completedYears=0 to hide completed,
  // 1/2/5/etc. to show that many years of recent finishes.
  const completedYearsRaw = searchParams.get('completedYears')
  const completedYearsParsed = completedYearsRaw != null ? Number(completedYearsRaw) : 2
  const completedYears = Number.isFinite(completedYearsParsed) && completedYearsParsed >= 0
    ? Math.min(20, completedYearsParsed)
    : 2

  // Recent activity filter (in months). 0 = no filter.
  const recentMonthsRaw = searchParams.get('recentMonths')
  const recentMonthsParsed = recentMonthsRaw != null ? Number(recentMonthsRaw) : 0
  const recentMonths = Number.isFinite(recentMonthsParsed) && recentMonthsParsed >= 0
    ? Math.min(120, recentMonthsParsed)
    : 0

  try {
    const permits = await fetchBuildingPermits(bounds, completedYears, recentMonths)
    return Response.json(permits)
  } catch (err) {
    console.error(err)
    return Response.json({ error: 'Failed to fetch permits' }, { status: 500 })
  }
}
