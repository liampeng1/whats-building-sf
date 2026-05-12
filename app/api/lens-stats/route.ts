import { NextRequest, NextResponse } from 'next/server'
import { computeLensStats } from '@/lib/lens-stats'
import { classifyTier, loadStations } from '@/lib/transit-stations'
import { fetchBuildingPermits } from '@/lib/datasf'

/**
 * /api/lens-stats — temporal per-lens rollups (neighborhood, zoning, transit
 * tier) over the trailing 12 months. Drives the lens-directory drawers.
 *
 * Runtime: edge. Both the permit loader (`fetchBuildingPermits` →
 * optional Upstash REST snapshot → DataSF fetch) and the transit-station
 * hydration use plain `fetch`; @upstash/redis is REST-based and
 * edge-compatible. Heavier per-region invocation is fine here — this is a
 * once-daily-revalidated read-only aggregate.
 *
 * Field-shape caveat (deferred work, see PLAN.md task 5+):
 *   The aggregator reads camelCase, enrichment fields
 *   (`neighborhood`, `useCategory`, `stage`, `netUnits`, `filedDate`,
 *   `issuedDate`, optional `zoning_category`). DataSF permits arrive as
 *   snake_case. Until the permit→lens enrichment lands, this route will
 *   return empty neighborhood/zoning rollups. The aggregator degrades
 *   gracefully (skips rows missing the expected fields) so the route
 *   shape stays stable for the UI.
 *
 * Caveat on classifyTier:
 *   `classifyTier` reads from module-level globals populated by
 *   `loadStations()`. We hydrate from same-origin /rail-stations.json
 *   etc. on first call. If hydration fails (e.g. no origin available)
 *   every permit classifies as 'poor', which is acceptable degraded
 *   behavior for an aggregate endpoint.
 */
export const runtime = 'edge'
export const revalidate = 86_400 // 24h — matches the daily DataSF snapshot

export async function GET(req: NextRequest) {
  try {
    // Hydrate transit stations from same-origin public assets so
    // classifyTier has data to compare against. Idempotent.
    await loadStations(req.nextUrl.origin)

    const permits = await fetchBuildingPermits(2, 0)
    const stats = computeLensStats({
      permits,
      now: new Date(),
      classifyTier,
    })
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
