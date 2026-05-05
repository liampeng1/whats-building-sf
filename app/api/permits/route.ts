import { fetchBuildingPermits } from '@/lib/datasf'

// Cache the route output for 6 hours. DataSF refreshes daily; 6h gives users
// a snappy experience while keeping data near-fresh. Vercel's fetch cache
// also dedupes the underlying DataSF calls across requests.
export const revalidate = 21600

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)

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
    const permits = await fetchBuildingPermits(completedYears, recentMonths)
    // Browser cache + CDN cache. stale-while-revalidate lets users see cached
    // data instantly even when the server cache is being refreshed.
    return Response.json(permits, {
      headers: {
        'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400',
      },
    })
  } catch (err) {
    console.error(err)
    return Response.json({ error: 'Failed to fetch permits' }, { status: 500 })
  }
}
