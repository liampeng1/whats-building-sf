import type { Feature, FeatureCollection, Polygon, MultiPolygon } from 'geojson'

/**
 * SF zoning districts as a GeoJSON FeatureCollection. Wraps DataSF's
 * `3i4a-hu95` dataset (Zoning Map · Zoning Districts) so the client can
 * pull a single bundled response instead of paging the upstream API.
 *
 * Cached aggressively on the edge — zoning boundaries change rarely.
 */

export const revalidate = 604800 // 7 days

const ZONING_DATASET = 'https://data.sfgov.org/resource/3i4a-hu95.json'

interface ZoningRow {
  the_geom?: Polygon | MultiPolygon
  zoning_sim?: string
  zoning?: string
  districtna?: string
  gen?: string
  codesectio?: string
}

export async function GET() {
  const headers: Record<string, string> = {}
  if (process.env.DATASF_APP_TOKEN) headers['X-App-Token'] = process.env.DATASF_APP_TOKEN
  // 50K is DataSF's hard SoQL maximum; current row count is ~450, so this
  // is plenty of headroom.
  const url = `${ZONING_DATASET}?$limit=5000&$select=the_geom,zoning_sim,districtna,gen,codesectio`
  try {
    const res = await fetch(url, { headers, next: { revalidate: 604800 } })
    if (!res.ok) {
      return Response.json({ error: 'upstream error' }, { status: 502 })
    }
    const rows: ZoningRow[] = await res.json()
    const features: Feature<Polygon | MultiPolygon>[] = rows
      .filter((r) => !!r.the_geom)
      .map((r) => ({
        type: 'Feature',
        geometry: r.the_geom as Polygon | MultiPolygon,
        properties: {
          zoning_sim: r.zoning_sim ?? r.zoning ?? '',
          districtna: r.districtna ?? '',
          gen: r.gen ?? '',
          codesectio: r.codesectio ?? '',
        },
      }))
    const collection: FeatureCollection = {
      type: 'FeatureCollection',
      features,
    }
    return Response.json(collection, {
      headers: {
        'Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=2592000',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err) {
    console.error('zoning fetch', err)
    return Response.json({ error: 'failed to fetch zoning' }, { status: 500 })
  }
}
