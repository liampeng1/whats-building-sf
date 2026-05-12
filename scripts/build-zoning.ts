/**
 * Fetches the full SF zoning dataset from DataSF and writes it to
 * public/zoning.geojson as a CDN-cacheable static asset. Rounds
 * coordinates to 5 decimal places (~1 m at SF latitude) to keep the
 * file under Vercel's static asset limits and well under the
 * client-side parse budget.
 *
 * Run: `npm run build:zoning` (or `npx tsx scripts/build-zoning.ts`)
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { Feature, FeatureCollection, Polygon, MultiPolygon } from 'geojson'

const ZONING_DATASET = 'https://data.sfgov.org/resource/3i4a-hu95.json'
const PUBLIC_DIR = path.join(process.cwd(), 'public')

interface ZoningRow {
  the_geom?: Polygon | MultiPolygon
  zoning_sim?: string
  zoning?: string
  districtna?: string
  gen?: string
  codesectio?: string
}

function roundCoord(n: number): number {
  return Math.round(n * 100000) / 100000  // 5 decimal places
}

function roundGeometry(g: Polygon | MultiPolygon): Polygon | MultiPolygon {
  if (g.type === 'Polygon') {
    return {
      type: 'Polygon',
      coordinates: g.coordinates.map((ring) => ring.map(([x, y]) => [roundCoord(x), roundCoord(y)])),
    }
  }
  return {
    type: 'MultiPolygon',
    coordinates: g.coordinates.map((poly) =>
      poly.map((ring) => ring.map(([x, y]) => [roundCoord(x), roundCoord(y)])),
    ),
  }
}

async function main() {
  const token = process.env.DATASF_APP_TOKEN
  const headers: Record<string, string> = {}
  if (token) headers['X-App-Token'] = token

  const url = `${ZONING_DATASET}?$limit=50000&$select=the_geom,zoning_sim,districtna,gen,codesectio`
  console.log('Fetching zoning…')
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`DataSF error: ${res.status}`)
  const rows: ZoningRow[] = await res.json()
  console.log(`Got ${rows.length} rows`)

  const features: Feature<Polygon | MultiPolygon>[] = rows
    .filter((r) => !!r.the_geom)
    .map((r) => ({
      type: 'Feature',
      geometry: roundGeometry(r.the_geom as Polygon | MultiPolygon),
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

  const out = path.join(PUBLIC_DIR, 'zoning.geojson')
  await fs.writeFile(out, JSON.stringify(collection))
  const stats = await fs.stat(out)
  console.log(`Wrote ${out} (${(stats.size / 1024 / 1024).toFixed(2)} MB, ${features.length} features)`)
}

main().catch((e) => { console.error(e); process.exit(1) })
