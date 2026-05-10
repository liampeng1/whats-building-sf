/**
 * Build cross-tabulations between SF's three lenses:
 *   • neighborhoods (41 SF Analysis Neighborhoods)
 *   • zoning categories (Residential / Mixed Use / Commercial / Industrial / Public)
 *   • transit distance bands (≤¼ mi / ≤½ mi / ≤1 mi from BART or Muni Metro)
 *
 * Outputs `public/cross-stats.json` (cross-tabs) and
 *         `public/transit-rings.geojson` (the ring polygons themselves so
 *          the client can render them without turf at runtime).
 *
 * Strategy: avoid turf.union (O(n²) and slow on 450 zoning polys). Instead
 * sum areas of pairwise intersections directly. ~50K turf.intersect calls
 * total, runs in ~30s.
 *
 * Run: `npx tsx scripts/build-cross-stats.ts`
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import * as turf from '@turf/turf'
import type { Feature, FeatureCollection, Polygon, MultiPolygon } from 'geojson'

const ROOT = process.cwd()
const PUBLIC_DIR = path.join(ROOT, 'public')
const NHOOD_PATH = path.join(PUBLIC_DIR, 'sf-neighborhoods.geojson')
const ZONING_DATASET = 'https://data.sfgov.org/resource/3i4a-hu95.json'
const OUT_PATH = path.join(PUBLIC_DIR, 'cross-stats.json')
const RINGS_PATH = path.join(PUBLIC_DIR, 'transit-rings.geojson')

const TRANSIT_BANDS = [0.25, 0.5, 1] as const

const ZONING_CATEGORIES = [
  'Residential',
  'Mixed Use',
  'Commercial',
  'Industrial',
  'Public',
  'Other',
] as const
type ZoningCategory = (typeof ZONING_CATEGORIES)[number]

const TRANSIT_STOPS: { name: string; lat: number; lng: number }[] = [
  { name: 'Embarcadero', lat: 37.792976, lng: -122.396957 },
  { name: 'Montgomery St', lat: 37.789256, lng: -122.401407 },
  { name: 'Powell St', lat: 37.784471, lng: -122.40798 },
  { name: 'Civic Center', lat: 37.779528, lng: -122.413756 },
  { name: '16th St / Mission', lat: 37.765222, lng: -122.419698 },
  { name: '24th St / Mission', lat: 37.752254, lng: -122.418466 },
  { name: 'Glen Park', lat: 37.733118, lng: -122.43399 },
  { name: 'Balboa Park', lat: 37.721617, lng: -122.447506 },
  { name: 'Daly City', lat: 37.706121, lng: -122.469081 },
  { name: 'Van Ness Station', lat: 37.775059, lng: -122.41907 },
  { name: 'Church Station', lat: 37.7654, lng: -122.4292 },
  { name: 'Castro Station', lat: 37.762, lng: -122.43492 },
  { name: 'Forest Hill Station', lat: 37.747234, lng: -122.45942 },
  { name: 'West Portal Station', lat: 37.7405, lng: -122.466595 },
  { name: 'J Church / 30th St', lat: 37.74236, lng: -122.42699 },
  { name: 'J Church / Balboa Park', lat: 37.72184, lng: -122.44757 },
  { name: 'K / Junipero Serra & Ocean', lat: 37.72325, lng: -122.45876 },
  { name: 'T Third / Mission Bay', lat: 37.76859, lng: -122.39239 },
  { name: 'T Third / 4th & King', lat: 37.77611, lng: -122.39444 },
  { name: 'T Third / Bayshore', lat: 37.71093, lng: -122.40183 },
  { name: 'Chinatown – Rose Pak', lat: 37.79428, lng: -122.40694 },
  { name: 'Union Square / Market', lat: 37.78664, lng: -122.40771 },
  { name: 'Yerba Buena / Moscone', lat: 37.78416, lng: -122.40124 },
  { name: 'L / 19th & Taraval', lat: 37.7427, lng: -122.4775 },
  { name: 'L / 30th & Taraval', lat: 37.7416, lng: -122.4904 },
  { name: 'L / Sunset Tunnel', lat: 37.7615, lng: -122.4514 },
  { name: 'M / Stonestown', lat: 37.7269, lng: -122.4748 },
  { name: 'M / Broad & Plymouth', lat: 37.7211, lng: -122.4577 },
  { name: 'N / Carl & Cole', lat: 37.7657, lng: -122.4509 },
  { name: 'N / 9th & Irving', lat: 37.7641, lng: -122.466 },
  { name: 'N / 19th & Judah', lat: 37.762, lng: -122.4778 },
  { name: 'N / Ocean Beach', lat: 37.7607, lng: -122.5085 },
]

interface NhoodStats {
  nhood: string
  area_sqm: number
  zoning_share: Partial<Record<ZoningCategory, number>>
  transit_coverage: { '0.25mi': number; '0.5mi': number; '1mi': number }
}
interface ZoningStats {
  category: ZoningCategory
  area_sqm: number
  share_of_sf: number
  neighborhood_share: Record<string, number>
  transit_coverage: { '0.25mi': number; '0.5mi': number; '1mi': number }
}
interface TransitBandStats {
  band: '0.25mi' | '0.5mi' | '1mi'
  area_sqm: number
  share_of_sf: number
  neighborhood_share: Record<string, number>
  zoning_share: Partial<Record<ZoningCategory, number>>
}

type AnyPoly = Feature<Polygon | MultiPolygon, Record<string, unknown>>

function safeArea(f: AnyPoly | null | undefined): number {
  if (!f) return 0
  try {
    return turf.area(f as Feature<Polygon | MultiPolygon>)
  } catch {
    return 0
  }
}

function safeIntersect(a: AnyPoly, b: AnyPoly): AnyPoly | null {
  try {
    const fc = turf.featureCollection([a, b])
    const r = turf.intersect(fc)
    return (r as AnyPoly | null) ?? null
  } catch {
    return null
  }
}

function pickCategory(props: Record<string, unknown>): ZoningCategory {
  const gen = String(props.gen ?? '')
  return (ZONING_CATEGORIES as readonly string[]).includes(gen)
    ? (gen as ZoningCategory)
    : 'Other'
}

async function loadNeighborhoods() {
  const buf = await fs.readFile(NHOOD_PATH, 'utf8')
  return JSON.parse(buf) as FeatureCollection<Polygon | MultiPolygon, { nhood: string }>
}

async function loadZoning() {
  const headers: Record<string, string> = {}
  if (process.env.DATASF_APP_TOKEN) headers['X-App-Token'] = process.env.DATASF_APP_TOKEN
  const url = `${ZONING_DATASET}?$limit=5000&$select=the_geom,zoning_sim,districtna,gen,codesectio`
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`Zoning fetch failed: ${res.status}`)
  type Row = {
    the_geom?: Polygon | MultiPolygon
    zoning_sim?: string
    districtna?: string
    gen?: string
    codesectio?: string
  }
  const rows: Row[] = await res.json()
  return rows
    .filter((r): r is Row & { the_geom: Polygon | MultiPolygon } => !!r.the_geom)
    .map<AnyPoly>((r) => ({
      type: 'Feature',
      geometry: r.the_geom,
      properties: {
        zoning_sim: r.zoning_sim ?? '',
        districtna: r.districtna ?? '',
        gen: r.gen ?? '',
        codesectio: r.codesectio ?? '',
        category: pickCategory({ gen: r.gen ?? '' }),
      },
    }))
}

function buildTransitRings(): Record<string, AnyPoly> {
  const out: Record<string, AnyPoly> = {}
  for (const miles of TRANSIT_BANDS) {
    // Build buffers around each stop, then merge with turf.union pairwise.
    // Buffers per stop: ~1-2k ms total for 32 stops; union is the slow part.
    // Since this only runs once with 32 features (not 450), it's fine.
    const buffers = TRANSIT_STOPS.map((s) =>
      turf.buffer(turf.point([s.lng, s.lat]), miles, { units: 'miles' }),
    ).filter((f): f is AnyPoly => !!f)
    let acc: AnyPoly = buffers[0]
    for (let i = 1; i < buffers.length; i++) {
      const fc = turf.featureCollection([acc, buffers[i]])
      const u = turf.union(fc)
      if (u) acc = u as AnyPoly
    }
    out[`${miles}mi`] = acc
  }
  return out
}

async function main() {
  console.log('• loading neighborhoods…')
  const nhoodGeo = await loadNeighborhoods()
  console.log(`  ${nhoodGeo.features.length} neighborhoods`)

  console.log('• loading zoning…')
  const zoningPolys = await loadZoning()
  console.log(`  ${zoningPolys.length} zoning polygons`)

  console.log('• building transit buffer rings…')
  const transitRings = buildTransitRings()
  console.log(`  bands: ${Object.keys(transitRings).join(', ')}`)

  // Persist transit rings as a GeoJSON file for client-side rendering.
  const ringsCollection: FeatureCollection = {
    type: 'FeatureCollection',
    features: TRANSIT_BANDS.map((miles) => {
      const ring = transitRings[`${miles}mi`]
      return {
        type: 'Feature',
        geometry: ring.geometry,
        properties: { band: `${miles}mi`, miles },
      }
    }),
  }
  await fs.writeFile(RINGS_PATH, JSON.stringify(ringsCollection))
  console.log(`✓ wrote ${RINGS_PATH}`)

  // Per-neighborhood
  console.log('• per-neighborhood cross-tabs…')
  const nhoodOut: NhoodStats[] = []
  for (const f of nhoodGeo.features) {
    const nhood = f.properties?.nhood ?? '—'
    const nhoodFeature = f as AnyPoly
    const totalArea = safeArea(nhoodFeature)
    const zoning_areas: Partial<Record<ZoningCategory, number>> = {}
    for (const z of zoningPolys) {
      const inter = safeIntersect(nhoodFeature, z)
      if (!inter) continue
      const a = safeArea(inter)
      if (a <= 0) continue
      const cat = z.properties.category as ZoningCategory
      zoning_areas[cat] = (zoning_areas[cat] ?? 0) + a
    }
    const zoning_share: Partial<Record<ZoningCategory, number>> = {}
    if (totalArea > 0) {
      for (const cat of ZONING_CATEGORIES) {
        const a = zoning_areas[cat] ?? 0
        if (a > 0) zoning_share[cat] = a / totalArea
      }
    }
    const tc = { '0.25mi': 0, '0.5mi': 0, '1mi': 0 } as Record<'0.25mi' | '0.5mi' | '1mi', number>
    for (const band of TRANSIT_BANDS) {
      const ring = transitRings[`${band}mi`]
      const inter = safeIntersect(nhoodFeature, ring)
      if (totalArea > 0) tc[`${band}mi`] = safeArea(inter) / totalArea
    }
    nhoodOut.push({ nhood, area_sqm: totalArea, zoning_share, transit_coverage: tc })
    process.stdout.write('.')
  }
  console.log(' ✓')

  // Per-zoning-category — sum across all polygons in that category
  console.log('• per-zoning cross-tabs…')
  const zoningOut: ZoningStats[] = []
  const totalSfArea = nhoodOut.reduce((s, r) => s + r.area_sqm, 0)
  for (const cat of ZONING_CATEGORIES) {
    const polysInCat = zoningPolys.filter((p) => p.properties.category === cat)
    let area = 0
    for (const p of polysInCat) area += safeArea(p)
    if (area <= 0) continue

    // Neighborhood share = sum across (cat polygons × nhoods) of intersection area, then per-nhood
    const nhoodArea = new Map<string, number>()
    for (const p of polysInCat) {
      for (const f of nhoodGeo.features) {
        const inter = safeIntersect(p, f as AnyPoly)
        if (!inter) continue
        const a = safeArea(inter)
        if (a <= 0) continue
        const key = f.properties?.nhood ?? '—'
        nhoodArea.set(key, (nhoodArea.get(key) ?? 0) + a)
      }
    }
    const neighborhood_share: Record<string, number> = {}
    for (const [n, a] of nhoodArea) neighborhood_share[n] = a / area

    // Transit coverage = sum across (cat polygons × ring) intersection
    const tc = { '0.25mi': 0, '0.5mi': 0, '1mi': 0 } as Record<'0.25mi' | '0.5mi' | '1mi', number>
    for (const band of TRANSIT_BANDS) {
      const ring = transitRings[`${band}mi`]
      let inBand = 0
      for (const p of polysInCat) {
        const inter = safeIntersect(p, ring)
        inBand += safeArea(inter)
      }
      tc[`${band}mi`] = inBand / area
    }

    zoningOut.push({
      category: cat,
      area_sqm: area,
      share_of_sf: totalSfArea > 0 ? area / totalSfArea : 0,
      neighborhood_share,
      transit_coverage: tc,
    })
    process.stdout.write('.')
  }
  console.log(' ✓')

  // Per-transit-band
  console.log('• per-transit-band cross-tabs…')
  const transitOut: TransitBandStats[] = []
  for (const band of TRANSIT_BANDS) {
    const ring = transitRings[`${band}mi`]
    const area = safeArea(ring)
    const neighborhood_share: Record<string, number> = {}
    for (const f of nhoodGeo.features) {
      const inter = safeIntersect(f as AnyPoly, ring)
      const a = safeArea(inter)
      if (a > 0 && area > 0) neighborhood_share[f.properties?.nhood ?? '—'] = a / area
    }
    // Zoning share within band
    const catArea: Partial<Record<ZoningCategory, number>> = {}
    for (const z of zoningPolys) {
      const inter = safeIntersect(z, ring)
      if (!inter) continue
      const a = safeArea(inter)
      if (a <= 0) continue
      const cat = z.properties.category as ZoningCategory
      catArea[cat] = (catArea[cat] ?? 0) + a
    }
    const zoning_share: Partial<Record<ZoningCategory, number>> = {}
    if (area > 0) {
      for (const cat of ZONING_CATEGORIES) {
        const a = catArea[cat] ?? 0
        if (a > 0) zoning_share[cat] = a / area
      }
    }
    transitOut.push({
      band: `${band}mi` as TransitBandStats['band'],
      area_sqm: area,
      share_of_sf: totalSfArea > 0 ? area / totalSfArea : 0,
      neighborhood_share,
      zoning_share,
    })
    process.stdout.write('.')
  }
  console.log(' ✓')

  const out = {
    generated_at: new Date().toISOString(),
    source_versions: {
      neighborhoods: 'public/sf-neighborhoods.geojson',
      zoning_dataset: '3i4a-hu95',
      transit_stops_count: TRANSIT_STOPS.length,
    },
    neighborhoods: nhoodOut.sort((a, b) => b.area_sqm - a.area_sqm),
    zoning: zoningOut.sort((a, b) => b.area_sqm - a.area_sqm),
    transit_bands: transitOut,
  }

  await fs.writeFile(OUT_PATH, JSON.stringify(out, null, 2))
  const stat = await fs.stat(OUT_PATH)
  console.log(`✓ wrote ${OUT_PATH} (${(stat.size / 1024).toFixed(1)} KB)`)
}

main().catch((err) => {
  console.error('cross-stats build failed:', err)
  process.exit(1)
})
