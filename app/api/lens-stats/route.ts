import { NextRequest, NextResponse } from 'next/server'
import { computeLensStats } from '@/lib/lens-stats'
import { classifyTier, loadStations } from '@/lib/transit-stations'
import { fetchBuildingPermits } from '@/lib/datasf'
import { enrichPermit, type NhoodFeatureCollection } from '@/lib/permit-enrich'

/**
 * /api/lens-stats — temporal per-lens rollups (neighborhood, zoning, transit
 * tier) over the trailing 12 months. Drives the lens-directory drawers.
 *
 * Runtime: Node (default). Matches the rest of app/api/. The permit
 * loader (`fetchBuildingPermits` → optional Upstash REST snapshot →
 * DataSF fetch) dynamically imports `@upstash/redis`, which has
 * historically been bundler-fragile on the edge runtime. This route is
 * invoked rarely (24h revalidation), so Node is the safer call.
 *
 * Caveat on classifyTier:
 *   `classifyTier` reads from module-level globals populated by
 *   `loadStations()`. We hydrate from same-origin /rail-stations.json
 *   etc. on first call. If hydration fails (e.g. no origin available)
 *   every permit classifies as 'poor', which is acceptable degraded
 *   behavior for an aggregate endpoint.
 */
export const revalidate = 86_400 // 24h — matches the daily DataSF snapshot

export async function GET(req: NextRequest) {
  try {
    // Hydrate transit stations from same-origin public assets so
    // classifyTier has data to compare against. Idempotent.
    await loadStations(req.nextUrl.origin)

    const permits = await fetchBuildingPermits(2, 0)

    // Enrich raw DataSF permits into the lens-flavored shape (camelCase
    // dates, derived neighborhood/useCategory/stage/netUnits) the
    // aggregator expects. Neighborhood assignment runs PIP against the
    // SF Analysis Neighborhoods polygons.
    const baseUrl = req.nextUrl.origin
    const nhoodGeo = (await fetch(`${baseUrl}/sf-neighborhoods.geojson`).then(
      (r) => (r.ok ? r.json() : null),
    )) as NhoodFeatureCollection | null

    let enrichedPermits: ReturnType<typeof enrichPermit>[] = []
    if (nhoodGeo) {
      enrichedPermits = permits.map((p) => enrichPermit(p, nhoodGeo))
    }

    const stats = computeLensStats({
      permits: enrichedPermits as any,
      now: new Date(),
      classifyTier,
    })
    if (permits.length > 0 && Object.keys(stats.neighborhoods).length === 0) {
      console.warn(
        '[lens-stats] Empty neighborhoods rollup despite ' + permits.length +
        ' permits. Likely a PIP failure (missing/empty SF neighborhoods GeoJSON).'
      )
    }
    return NextResponse.json(stats, {
      headers: {
        'Cache-Control':
          'public, s-maxage=86400, stale-while-revalidate=3600',
      },
    })
  } catch (err) {
    console.error('lens-stats', err)
    return NextResponse.json(
      { error: 'failed to compute lens stats' },
      { status: 500 },
    )
  }
}
