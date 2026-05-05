import type { Polygon, MultiPolygon } from 'geojson'

// Parcel polygons are stable for years; cache aggressively. Keyed by
// block + lot in the URL so different parcels don't collide on the cache.
export const revalidate = 86400

const PARCELS_DATASET = 'acdm-wktn'
const BASE_URL = 'https://data.sfgov.org/resource'

interface ParcelRow {
  mapblklot?: string
  shape?: Polygon | MultiPolygon
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const block = searchParams.get('block')
  const lot = searchParams.get('lot')
  if (!block || !lot) {
    return Response.json({ error: 'block and lot are required' }, { status: 400 })
  }
  // Only digits + uppercase A–Z appear in valid SF block/lot codes; reject
  // anything else so the SoQL string can't be tampered with via injection.
  if (!/^[0-9A-Z]+$/i.test(block) || !/^[0-9A-Z]+$/i.test(lot)) {
    return Response.json({ error: 'invalid block or lot' }, { status: 400 })
  }

  const params = new URLSearchParams({
    $select: 'mapblklot,shape',
    $where: `block_num='${block.toUpperCase()}' AND lot_num='${lot.toUpperCase()}'`,
    $limit: '1',
  })
  const headers: Record<string, string> = {}
  if (process.env.DATASF_APP_TOKEN) headers['X-App-Token'] = process.env.DATASF_APP_TOKEN

  try {
    const res = await fetch(`${BASE_URL}/${PARCELS_DATASET}.json?${params}`, {
      headers,
      next: { revalidate: 86400 },
    })
    if (!res.ok) {
      return Response.json({ error: 'upstream error' }, { status: 502 })
    }
    const rows: ParcelRow[] = await res.json()
    const shape = rows[0]?.shape
    if (!shape) {
      return Response.json({ error: 'not found' }, { status: 404 })
    }
    return Response.json(
      { mapblklot: rows[0].mapblklot, shape },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        },
      },
    )
  } catch (err) {
    console.error('parcel fetch failed', err)
    return Response.json({ error: 'failed to fetch parcel' }, { status: 500 })
  }
}
