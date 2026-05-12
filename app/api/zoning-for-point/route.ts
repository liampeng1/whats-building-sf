import { NextRequest } from 'next/server'
import { pointInGeometry } from '@/lib/point-in-polygon'
import type { FeatureCollection, Polygon, MultiPolygon } from 'geojson'

export const revalidate = 604800 // 7 days — matches /api/zoning bulk fetch

interface ZoningProps {
  zoning_sim: string
  gen: string
}

let cached: FeatureCollection<Polygon | MultiPolygon, ZoningProps> | null = null

async function loadZoning(
  req: NextRequest,
): Promise<FeatureCollection<Polygon | MultiPolygon, ZoningProps> | null> {
  if (cached) return cached
  // Reuse the /api/zoning route so caching + error handling stay centralized.
  const base = req.nextUrl.origin
  const res = await fetch(`${base}/api/zoning`, { next: { revalidate: 604800 } })
  if (!res.ok) return null
  cached = (await res.json()) as FeatureCollection<Polygon | MultiPolygon, ZoningProps>
  return cached
}

export async function GET(req: NextRequest) {
  const lng = Number(req.nextUrl.searchParams.get('lng'))
  const lat = Number(req.nextUrl.searchParams.get('lat'))
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return Response.json({ error: 'lng and lat are required' }, { status: 400 })
  }

  const geo = await loadZoning(req)
  if (!geo) return Response.json({ zoning_sim: null, gen: null }, { status: 200 })

  for (const f of geo.features) {
    if (pointInGeometry(lng, lat, f.geometry)) {
      return Response.json(
        {
          zoning_sim: f.properties.zoning_sim || null,
          gen: f.properties.gen || null,
        },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=2592000',
          },
        },
      )
    }
  }
  return Response.json(
    { zoning_sim: null, gen: null },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=2592000',
      },
    },
  )
}
