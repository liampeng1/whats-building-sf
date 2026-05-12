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
import type { TransitTier } from '../lib/transit-stations'
import {
  fetchBartCorridors,
  fetchMuniCorridors,
  fetchCaltrainCorridors,
  type CorridorFeature,
} from './sources/transit-corridors'

const ROOT = process.cwd()
const PUBLIC_DIR = path.join(ROOT, 'public')
const NHOOD_PATH = path.join(PUBLIC_DIR, 'sf-neighborhoods.geojson')
const ZONING_DATASET = 'https://data.sfgov.org/resource/3i4a-hu95.json'
const OUT_PATH = path.join(PUBLIC_DIR, 'cross-stats.json')
const RINGS_PATH = path.join(PUBLIC_DIR, 'transit-rings.geojson')
const TIERS_PATH = path.join(PUBLIC_DIR, 'transit-tiers.geojson')
const LOCAL_STOPS_PATH = path.join(PUBLIC_DIR, 'frequent-local-stops.json')

/** ¼-mile in miles — matches RAIL_THRESHOLD_M (400m ≈ 0.2486 mi) in lib/transit-stations.ts. */
const NEAR_RAIL_BUFFER_MI = 0.25

/** Plain-English names for the ~30 most common Planning-Code zoning_sim
 *  district codes. Unknown codes fall back to using the code itself. Used by
 *  the per-category drill-down emitted to cross-stats.json. */
const DISTRICT_NAMES: Record<string, string> = {
  'RH-1': 'Residential — single-family',
  'RH-2': 'Residential — two-family',
  'RH-3': 'Residential — three-family',
  'RM-1': 'Residential — low density mix',
  'RM-2': 'Residential — moderate density',
  'RM-3': 'Residential — medium density',
  'RM-4': 'Residential — high density',
  'RTO': 'Residential transit-oriented',
  'RTO-M': 'Residential transit-oriented (Mission)',
  'NCT-1': 'Neighborhood transit, low-scale',
  'NCT-2': 'Neighborhood transit, small-scale',
  'NCT-3': 'Neighborhood transit, moderate-scale',
  'NCT-4': 'Neighborhood transit, high-density',
  'NC-1': 'Neighborhood commercial, cluster',
  'NC-2': 'Neighborhood commercial, small-scale',
  'NC-3': 'Neighborhood commercial, moderate-scale',
  'NC-S': 'Neighborhood commercial shopping center',
  'C-1': 'Neighborhood-serving commercial',
  'C-2': 'Community business district',
  'C-3-O': 'Downtown office',
  'C-3-R': 'Downtown retail',
  'C-3-S': 'Downtown support',
  'C-3-G': 'Downtown general',
  'MUR': 'Mixed-use residential',
  'MUO': 'Mixed-use office',
  'MUG': 'Mixed-use general',
  'M-1': 'Light industrial',
  'M-2': 'Heavy industrial',
  'P': 'Public',
  'PDR-1-B': 'Production / distribution / repair, low-intensity',
  'PDR-1-D': 'Production / distribution / repair, design',
  'PDR-1-G': 'Production / distribution / repair, general',
  'PDR-2': 'Production / distribution / repair, core',
  'SLR': 'South of Market Living / Rental',
  'SLI': 'South of Market Light Industrial',
}

const DISTRICT_DESCRIPTIONS: Record<string, string> = {
  'RH-1': 'One dwelling unit per lot. The classic single-family detached SF block.',
  'RH-2': 'Up to two units per lot. Duplex + flat territory.',
  'RH-3': 'Up to three units per lot. Often paired with low-rise heights.',
  'RM-1': 'Lower-density apartment buildings; ~1 unit per 800 sf lot area.',
  'RM-2': 'Moderate apartment density; ~1 unit per 600 sf lot area.',
  'RM-3': 'Medium-density apartment buildings; ~1 unit per 400 sf lot area.',
  'RM-4': 'Highest-density Residential; ~1 unit per 200 sf lot area.',
  'RTO': 'Transit-oriented residential — dense infill near transit corridors.',
  'RTO-M': 'Mission-specific RTO variant calibrated to neighborhood scale.',
  'NCT-1': 'Walkable storefronts on small commercial streets near transit.',
  'NCT-2': 'Two-to-three-story neighborhood commercial along transit corridors.',
  'NCT-3': 'Three-to-four-story mixed-use along high-ridership transit.',
  'NCT-4': 'High-density neighborhood transit corridor — biggest envelopes.',
  'NC-1': 'Scattered storefronts in primarily residential areas.',
  'NC-2': 'Small neighborhood commercial nodes.',
  'NC-3': 'Moderate-scale neighborhood commercial streets.',
  'NC-S': 'Large shopping-center configurations.',
  'C-1': 'Neighborhood-serving commercial; mostly retail / service.',
  'C-2': 'Community business district with broader retail mix.',
  'C-3-O': 'Downtown office core — tallest office envelopes.',
  'C-3-R': 'Downtown retail core — Union Square and adjacent blocks.',
  'C-3-S': 'Downtown support — back-office, services adjacent to the core.',
  'C-3-G': 'Downtown general — mixed office, retail, residential.',
  'MUR': 'Mixed-use with a residential emphasis.',
  'MUO': 'Mixed-use with an office emphasis.',
  'MUG': 'General mixed-use — residential, retail, light commercial.',
  'M-1': 'Light industrial uses — manufacturing, distribution, services.',
  'M-2': 'Heavy industrial uses — port-related, large-footprint operations.',
  'P': 'Public lands — parks, civic facilities, schools.',
  'PDR-1-B': 'Low-intensity production / distribution / repair; small-business scale.',
  'PDR-1-D': 'PDR with a design-and-build emphasis (e.g., fashion, prototyping).',
  'PDR-1-G': 'General PDR — broad mix of light-industrial uses.',
  'PDR-2': 'Core PDR for heavier production-and-distribution activity.',
  'SLR': 'South of Market live/work and rental housing.',
  'SLI': 'South of Market light-industrial / PDR mix.',
}

const TRANSIT_BANDS = [0.1, 0.25] as const
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


interface ZoningDistrict {
  code: string
  name: string
  description: string
  land_share_within_cat: number
}
interface NhoodStats {
  nhood: string
  area_sqm: number
  zoning_share: Partial<Record<ZoningCategory, number>>
  transit_coverage: { '0.1mi': number; '0.25mi': number }
  near_rail_pct: number
}
interface ZoningStats {
  category: ZoningCategory
  area_sqm: number
  share_of_sf: number
  neighborhood_share: Record<string, number>
  transit_coverage: { '0.1mi': number; '0.25mi': number }
  districts: ZoningDistrict[]
}
interface TransitBandStats {
  band: '0.1mi' | '0.25mi'
  area_sqm: number
  share_of_sf: number
  neighborhood_share: Record<string, number>
  zoning_share: Partial<Record<ZoningCategory, number>>
}
interface TierStats {
  tier: TransitTier
  area_sqm: number
  share_of_sf: number
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

function safeUnion(a: AnyPoly | null, b: AnyPoly | null): AnyPoly | null {
  if (!a) return b
  if (!b) return a
  try {
    const u = turf.union(turf.featureCollection([a, b]))
    return (u as AnyPoly | null) ?? a
  } catch {
    return a
  }
}

function safeDifference(a: AnyPoly | null, b: AnyPoly | null): AnyPoly | null {
  if (!a) return null
  if (!b) return a
  try {
    const d = turf.difference(turf.featureCollection([a, b]))
    return (d as AnyPoly | null) ?? null
  } catch {
    return a
  }
}

/** Buffer a list of point stops by N miles, then union all buffers into a
 *  single polygon. Returns null if `stops` is empty. The polygon count after
 *  buffering is modest (≤ ~200 stops per mode) so a plain pairwise union
 *  works in seconds. */
function bufferUnion(
  stops: { lat: number; lng: number }[],
  miles: number,
): AnyPoly | null {
  if (stops.length === 0) return null
  const buffers = stops
    .map((s) => turf.buffer(turf.point([s.lng, s.lat]), miles, { units: 'miles' }))
    .filter((f): f is AnyPoly => !!f)
  if (buffers.length === 0) return null
  let acc: AnyPoly = buffers[0]
  for (let i = 1; i < buffers.length; i++) {
    const u = safeUnion(acc, buffers[i])
    if (u) acc = u
  }
  return acc
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
  // Dataset is ~10.6K rows as of 2026-05; 50K is DataSF's hard SoQL ceiling.
  // Keep this in sync with app/api/zoning/route.ts — a stale lower limit here
  // silently hides codes from the fail-fast check below.
  const url = `${ZONING_DATASET}?$limit=50000&$select=the_geom,zoning_sim,districtna,gen,codesectio`
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

  // Codes intentionally rendered via the panel's graceful fallback rather
  // than transcribed into ZONING_RULES. Two reasons a code lands here:
  //   • TI-* / YBI-* — Treasure Island / Yerba Buena Island districts are
  //     governed by the TIDA Sub-Area Plan, not the SF Planning Code.
  //   • Real Planning Code districts we haven't transcribed yet — the panel
  //     surfaces the §codesectio reference + amlegal link instead of empty.
  // Any code outside this set will still fail the build, so new districts
  // (post-Planning-Code amendment) get caught loudly.
  const KNOWN_NO_RULES = new Set([
    // TIDA — governed elsewhere
    'TI-R', 'TI-MU', 'TI-OS', 'TI-PCI',
    'YBI-R', 'YBI-MU', 'YBI-OS', 'YBI-PCI',
    // Higher-density Residential — Planning Code §209
    'RH-1(D)', 'RH-1(S)',
    'RM-2', 'RM-3', 'RM-4',
    // Transit-oriented Residential — §207.6
    'RTO-1', 'RTO-M',
    // Downtown Residential Transfer
    'RH DTR', 'SB-DTR', 'TB DTR',
    // Misc Mixed Use / Industrial — Planning Code §219, §216
    'UMU', 'SALI', 'S-MU', 'SPD', 'WMUO',
  ])
  const presentCodes = new Set(Object.keys(ZONING_RULES))
  const datasetCodes = new Set(
    zoningPolys
      .map((z) => (z.properties as { zoning_sim?: string }).zoning_sim)
      .filter((c): c is string => !!c),
  )
  const missing = [...datasetCodes].filter(
    (c) => !presentCodes.has(c) && !KNOWN_NO_RULES.has(c),
  )
  if (missing.length > 0) {
    throw new Error(
      `zoning-rules missing transcription for ${missing.length} unaccounted codes:\n  ${missing.join('\n  ')}\n` +
      `Either add records to lib/zoning-rules.ts, or — if intentionally\n` +
      `rendered via the panel fallback — add to KNOWN_NO_RULES in this file.`,
    )
  }
  const fallbackCount = [...datasetCodes].filter((c) => !presentCodes.has(c)).length
  console.log(
    `✓ zoning-rules coverage: ${datasetCodes.size - fallbackCount}/${datasetCodes.size} transcribed` +
    (fallbackCount > 0 ? ` (${fallbackCount} via fallback)` : ''),
  )

  console.log('• loading rail stations from BART + Muni + Caltrain…')
  const [bart, muni, caltrain] = await Promise.all([
    fetchBartStations(),
    fetchMuni(),
    fetchCaltrainSfStations(),
  ])
  const rail = mergeRailStations([...bart, ...muni.rail, ...caltrain])
  const rapid = muni.rapid
  const local = muni.local
  console.log(`  rail: ${rail.length}, rapid bus: ${rapid.length}, frequent local: ${local.length}`)

  await fs.writeFile(path.join(PUBLIC_DIR, 'rail-stations.json'), JSON.stringify(rail, null, 2))
  await fs.writeFile(path.join(PUBLIC_DIR, 'rapid-bus-stops.json'), JSON.stringify(rapid, null, 2))
  await fs.writeFile(LOCAL_STOPS_PATH, JSON.stringify(local, null, 2))

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

  console.log('• building per-mode ¼-mile buffer unions for tier polygons…')
  const railBuffer = bufferUnion(rail, NEAR_RAIL_BUFFER_MI)
  const rapidBuffer = bufferUnion(rapid, NEAR_RAIL_BUFFER_MI)
  const localBuffer = bufferUnion(local, NEAR_RAIL_BUFFER_MI)
  const anyFrequentBuffer = safeUnion(safeUnion(railBuffer, rapidBuffer), localBuffer)
  console.log(
    `  rail-buf: ${railBuffer ? 'ok' : '—'}, rapid-buf: ${rapidBuffer ? 'ok' : '—'}, ` +
    `local-buf: ${localBuffer ? 'ok' : '—'}, any-frequent: ${anyFrequentBuffer ? 'ok' : '—'}`,
  )

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

  console.log('• fetching transit corridors (BART + Muni + Caltrain)…')
  const [bartCorridors, muniCorridors, caltrainCorridors] = await Promise.all([
    fetchBartCorridors().catch((e) => { console.warn('BART corridors failed:', e); return [] as CorridorFeature[] }),
    fetchMuniCorridors().catch((e) => { console.warn('Muni corridors failed:', e); return [] as CorridorFeature[] }),
    fetchCaltrainCorridors().catch((e) => { console.warn('Caltrain corridors failed:', e); return [] as CorridorFeature[] }),
  ])
  const allCorridors: CorridorFeature[] = [
    ...bartCorridors,
    ...muniCorridors,
    ...caltrainCorridors,
  ]
  console.log(`  corridors: bart=${bartCorridors.length}, muni=${muniCorridors.length}, caltrain=${caltrainCorridors.length}`)
  const corridorsCollection: FeatureCollection = {
    type: 'FeatureCollection',
    features: allCorridors,
  }
  await fs.writeFile(
    path.join(PUBLIC_DIR, 'transit-corridors.geojson'),
    JSON.stringify(corridorsCollection),
  )
  console.log(`✓ wrote transit-corridors.geojson (${allCorridors.length} features)`)

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
    const tc = { '0.1mi': 0, '0.25mi': 0 } as Record<'0.1mi' | '0.25mi', number>
    for (const band of TRANSIT_BANDS) {
      const ring = transitRings[`${band}mi`]
      const inter = safeIntersect(nhoodFeature, ring)
      if (totalArea > 0) tc[`${band}mi`] = safeArea(inter) / totalArea
    }
    // near_rail_pct: % of nhood within ¼ mi of any frequent transit
    // (rail ∪ rapid-bus ∪ frequent-local).
    let near_rail_pct = 0
    if (anyFrequentBuffer && totalArea > 0) {
      const inter = safeIntersect(nhoodFeature, anyFrequentBuffer)
      near_rail_pct = safeArea(inter) / totalArea
    }
    nhoodOut.push({
      nhood, area_sqm: totalArea, zoning_share, transit_coverage: tc, near_rail_pct,
    })
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
    const tc = { '0.1mi': 0, '0.25mi': 0 } as Record<'0.1mi' | '0.25mi', number>
    for (const band of TRANSIT_BANDS) {
      const ring = transitRings[`${band}mi`]
      let inBand = 0
      for (const p of polysInCat) {
        const inter = safeIntersect(p, ring)
        inBand += safeArea(inter)
      }
      tc[`${band}mi`] = inBand / area
    }

    // Per-district drill-down: group cat's polygons by zoning_sim code and
    // sum area per district, then compute share within the parent category.
    const districtArea = new Map<string, number>()
    for (const p of polysInCat) {
      const code = String((p.properties as { zoning_sim?: string }).zoning_sim ?? '')
      if (!code) continue
      districtArea.set(code, (districtArea.get(code) ?? 0) + safeArea(p))
    }
    const districts: ZoningDistrict[] = [...districtArea.entries()]
      .map(([code, a]) => ({
        code,
        name: DISTRICT_NAMES[code] ?? code,
        description: DISTRICT_DESCRIPTIONS[code] ?? '',
        land_share_within_cat: area > 0 ? a / area : 0,
      }))
      .sort((a, b) => b.land_share_within_cat - a.land_share_within_cat)

    zoningOut.push({
      category: cat,
      area_sqm: area,
      share_of_sf: totalSfArea > 0 ? area / totalSfArea : 0,
      neighborhood_share,
      transit_coverage: tc,
      districts,
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

  // Four mutually-exclusive transit-tier polygons:
  //   rail       = rail-buffer
  //   rapid-bus  = rapid-buffer − rail
  //   local-bus  = local-buffer − (rail ∪ rapid-bus)
  //   poor       = sf-outline − (rail ∪ rapid-bus ∪ local-bus)
  console.log('• building transit-tier polygons…')
  // SF outline = pairwise union of all neighborhood polygons. We don't ship
  // a separate sf-outline.geojson asset, so reuse the nhood layer.
  let sfOutline: AnyPoly | null = null
  for (const f of nhoodGeo.features) {
    sfOutline = sfOutline ? safeUnion(sfOutline, f as AnyPoly) : (f as AnyPoly)
  }
  const tierRail = railBuffer
  const tierRapidBus = safeDifference(rapidBuffer, tierRail)
  const railOrRapid = safeUnion(tierRail, tierRapidBus)
  const tierLocalBus = safeDifference(localBuffer, railOrRapid)
  const allFrequent = safeUnion(railOrRapid, tierLocalBus)
  const tierPoor = safeDifference(sfOutline, allFrequent)
  const sfArea = safeArea(sfOutline) || totalSfArea || 1

  // Clip each tier polygon to the SF outline. Without this, rail and rapid-bus
  // buffers extend across the Bay (e.g. BART stations in Oakland/Berkeley have
  // 400m buffers that protrude beyond SF land), so the four shares add up to
  // > 100% of SF area. We also persist the clipped polygons so the rendered
  // map layer doesn't show rings spilling into the water.
  const tierFeatures: Array<{ tier: TransitTier; poly: AnyPoly | null }> = [
    { tier: 'rail', poly: sfOutline ? safeIntersect(tierRail!, sfOutline) : tierRail },
    { tier: 'rapid-bus', poly: sfOutline && tierRapidBus ? safeIntersect(tierRapidBus, sfOutline) : tierRapidBus },
    { tier: 'local-bus', poly: sfOutline && tierLocalBus ? safeIntersect(tierLocalBus, sfOutline) : tierLocalBus },
    // tierPoor is already (sfOutline − allFrequent), so it's inside SF by construction.
    { tier: 'poor', poly: tierPoor },
  ]
  const transit_tiers: TierStats[] = tierFeatures.map(({ tier, poly }) => {
    const a = safeArea(poly)
    return { tier, area_sqm: a, share_of_sf: a / sfArea }
  })
  console.log(
    `  tiers: ${transit_tiers.map((t) => `${t.tier}=${(t.share_of_sf * 100).toFixed(1)}%`).join(' ')}`,
  )

  const tiersCollection: FeatureCollection = {
    type: 'FeatureCollection',
    features: tierFeatures.flatMap(({ tier, poly }) => {
      if (!poly) return []
      return [{
        type: 'Feature' as const,
        geometry: poly.geometry,
        properties: { tier },
      }]
    }),
  }
  await fs.writeFile(TIERS_PATH, JSON.stringify(tiersCollection))
  console.log(`✓ wrote ${TIERS_PATH}`)

  const out = {
    generated_at: new Date().toISOString(),
    source_versions: {
      neighborhoods: 'public/sf-neighborhoods.geojson',
      zoning_dataset: '3i4a-hu95',
      height_dataset: 'h9wh-cg3m',
      rail_stations_count: rail.length,
      rapid_bus_stops_count: rapid.length,
      frequent_local_stops_count: local.length,
    },
    neighborhoods: nhoodOut.sort((a, b) => b.area_sqm - a.area_sqm),
    zoning: zoningOut.sort((a, b) => b.area_sqm - a.area_sqm),
    transit_bands: transitOut,
    transit_bands_rapid_bus: rapidBusOut,
    transit_tiers,
  }

  await fs.writeFile(OUT_PATH, JSON.stringify(out, null, 2))
  const stat = await fs.stat(OUT_PATH)
  console.log(`✓ wrote ${OUT_PATH} (${(stat.size / 1024).toFixed(1)} KB)`)
}

main().catch((err) => {
  console.error('cross-stats build failed:', err)
  process.exit(1)
})
