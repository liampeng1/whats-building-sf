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
import { fetchBartStations } from './sources/bart-stations'
import { fetchMuni } from './sources/muni-stops'
import { fetchCaltrainSfStations } from './sources/caltrain-stations'
import { mergeRailStations } from './sources/merge-rail'
import { fetchHeightPolygons, joinHeightsToZoning } from './sources/zoning-heights'
import { ZONING_RULES } from '../lib/zoning-rules'

const ROOT = process.cwd()
const PUBLIC_DIR = path.join(ROOT, 'public')
const NHOOD_PATH = path.join(PUBLIC_DIR, 'sf-neighborhoods.geojson')
const ZONING_DATASET = 'https://data.sfgov.org/resource/3i4a-hu95.json'
const OUT_PATH = path.join(PUBLIC_DIR, 'cross-stats.json')
const RINGS_PATH = path.join(PUBLIC_DIR, 'transit-rings.geojson')

const TRANSIT_BANDS = [0.25, 0.5, 1] as const
const RAPID_BUS_BANDS = [0.1, 0.25] as const

const ZONING_CATEGORIES = [
  'Residential',
  'Mixed Use',
  'Commercial',
  'Industrial',
  'Public',
  'Other',
] as const
type ZoningCategory = (typeof ZONING_CATEGORIES)[number]


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

function buildTransitRings(
  stops: { lat: number; lng: number }[],
  bands: readonly number[],
): Record<string, AnyPoly> {
  const out: Record<string, AnyPoly> = {}
  for (const miles of bands) {
    const buffers = stops
      .map((s) => turf.buffer(turf.point([s.lng, s.lat]), miles, { units: 'miles' }))
      .filter((f): f is AnyPoly => !!f)
    if (buffers.length === 0) continue
    let acc: AnyPoly = buffers[0]
    for (let i = 1; i < buffers.length; i++) {
      const u = turf.union(turf.featureCollection([acc, buffers[i]]))
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

  // Fail-fast: every zoning_sim from DataSF must have a transcribed record.
  // Prevents new districts (post-Planning-Code amendment) from rendering as blank.
  const presentCodes = new Set(Object.keys(ZONING_RULES))
  const datasetCodes = new Set(
    zoningPolys
      .map((z) => (z.properties as { zoning_sim?: string }).zoning_sim)
      .filter((c): c is string => !!c),
  )
  const missing = [...datasetCodes].filter((c) => !presentCodes.has(c))
  if (missing.length > 0) {
    throw new Error(
      `zoning-rules missing transcription for ${missing.length} codes:\n  ${missing.join('\n  ')}\n` +
      `Add records to lib/zoning-rules.ts.`,
    )
  }
  console.log(`✓ zoning-rules coverage: ${datasetCodes.size}/${datasetCodes.size}`)

  console.log('• loading rail stations from BART + Muni + Caltrain…')
  const [bart, muni, caltrain] = await Promise.all([
    fetchBartStations(),
    fetchMuni(),
    fetchCaltrainSfStations(),
  ])
  const rail = mergeRailStations([...bart, ...muni.rail, ...caltrain])
  const rapid = muni.rapid
  console.log(`  rail: ${rail.length}, rapid bus: ${rapid.length}`)

  await fs.writeFile(path.join(PUBLIC_DIR, 'rail-stations.json'), JSON.stringify(rail, null, 2))
  await fs.writeFile(path.join(PUBLIC_DIR, 'rapid-bus-stops.json'), JSON.stringify(rapid, null, 2))

  console.log('• loading height/bulk districts (h9wh-cg3m)…')
  const heightPolys = await fetchHeightPolygons()
  console.log(`  ${heightPolys.length} height polygons`)

  const zoningWithSim = zoningPolys.map((z) => ({
    type: 'Feature' as const,
    geometry: z.geometry,
    properties: { zoning_sim: (z.properties as { zoning_sim?: string }).zoning_sim ?? '' },
  }))
  const heights = joinHeightsToZoning(zoningWithSim, heightPolys)
  await fs.writeFile(path.join(PUBLIC_DIR, 'zoning-heights.json'), JSON.stringify(heights, null, 2))
  console.log(`✓ wrote zoning-heights.json (${heights.length} codes)`)

  console.log('• building transit buffer rings…')
  const transitRings = buildTransitRings(rail, TRANSIT_BANDS)
  const rapidBusRings = buildTransitRings(rapid, RAPID_BUS_BANDS)
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

  const rapidBusRingsCollection: FeatureCollection = {
    type: 'FeatureCollection',
    features: RAPID_BUS_BANDS.flatMap((miles) => {
      const ring = rapidBusRings[`${miles}mi`]
      if (!ring) return []
      return [{
        type: 'Feature' as const,
        geometry: ring.geometry,
        properties: { band: `${miles}mi`, miles },
      }]
    }),
  }
  await fs.writeFile(
    path.join(PUBLIC_DIR, 'rapid-bus-rings.geojson'),
    JSON.stringify(rapidBusRingsCollection),
  )
  console.log(`✓ wrote rapid-bus-rings.geojson`)

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

  console.log('• per-rapid-bus-band cross-tabs…')
  const rapidBusOut: TransitBandStats[] = []
  for (const band of RAPID_BUS_BANDS) {
    const ring = rapidBusRings[`${band}mi`]
    if (!ring) continue
    const area = safeArea(ring)
    const neighborhood_share: Record<string, number> = {}
    for (const f of nhoodGeo.features) {
      const inter = safeIntersect(f as AnyPoly, ring)
      const a = safeArea(inter)
      if (a > 0 && area > 0) neighborhood_share[f.properties?.nhood ?? '—'] = a / area
    }
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
    rapidBusOut.push({
      band: `${band}mi` as TransitBandStats['band'], // 0.1mi joins the union in Task 2.3
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
      height_dataset: 'h9wh-cg3m',
      rail_stations_count: rail.length,
      rapid_bus_stops_count: rapid.length,
    },
    neighborhoods: nhoodOut.sort((a, b) => b.area_sqm - a.area_sqm),
    zoning: zoningOut.sort((a, b) => b.area_sqm - a.area_sqm),
    transit_bands: transitOut,
    transit_bands_rapid_bus: rapidBusOut,
  }

  await fs.writeFile(OUT_PATH, JSON.stringify(out, null, 2))
  const stat = await fs.stat(OUT_PATH)
  console.log(`✓ wrote ${OUT_PATH} (${(stat.size / 1024).toFixed(1)} KB)`)
}

main().catch((err) => {
  console.error('cross-stats build failed:', err)
  process.exit(1)
})
