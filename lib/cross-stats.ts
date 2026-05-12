/**
 * Typed accessors for the pre-computed cross-stats bundle. Exact shape
 * mirrors `scripts/build-cross-stats.ts`'s output. The static JSON lives
 * at /public/cross-stats.json, served as an edge-cached static asset.
 */

export type ZoningCategory =
  | 'Residential'
  | 'Mixed Use'
  | 'Commercial'
  | 'Industrial'
  | 'Public'
  | 'Other'

export type TransitBand = '0.1mi' | '0.25mi'

export type RapidBusBand = '0.1mi' | '0.25mi'

export const ZONING_CATEGORY_ORDER: ZoningCategory[] = [
  'Residential',
  'Mixed Use',
  'Commercial',
  'Industrial',
  'Public',
  'Other',
]

export const TRANSIT_BAND_ORDER: TransitBand[] = ['0.1mi', '0.25mi']

export const RAPID_BUS_BAND_ORDER: RapidBusBand[] = ['0.1mi', '0.25mi']

export interface NhoodStats {
  nhood: string
  area_sqm: number
  zoning_share: Partial<Record<ZoningCategory, number>>
  transit_coverage: Record<TransitBand, number>
  /** % of nhood land within ¼ mi of any frequent transit (rail ∪ rapid-bus ∪ frequent-local). */
  near_rail_pct: number
}

export interface ZoningDistrict {
  /** Planning-code district code, e.g. "RH-1". */
  code: string
  /** Human-readable name, e.g. "Residential — single-family". */
  name: string
  /** One-line plain-English description. */
  description: string
  /** 0..1 — share of the parent zoning category's total area. */
  land_share_within_cat: number
}

export interface ZoningStats {
  category: ZoningCategory
  area_sqm: number
  share_of_sf: number
  neighborhood_share: Record<string, number>
  transit_coverage: Record<TransitBand, number>
  /** Drill-down: zoning_sim districts inside this category, sorted by share desc. */
  districts: ZoningDistrict[]
}

export type { TransitTier } from './transit-stations'
import type { TransitTier } from './transit-stations'

export interface TierStats {
  tier: TransitTier
  area_sqm: number
  share_of_sf: number
}

export interface TransitBandStats {
  band: TransitBand
  area_sqm: number
  share_of_sf: number
  neighborhood_share: Record<string, number>
  zoning_share: Partial<Record<ZoningCategory, number>>
}

export interface RapidBusBandStats {
  band: RapidBusBand
  area_sqm: number
  share_of_sf: number
  neighborhood_share: Record<string, number>
  zoning_share: Partial<Record<ZoningCategory, number>>
}

export interface CrossStats {
  generated_at: string
  source_versions: {
    neighborhoods: string
    zoning_dataset: string
    transit_stops_count: number
  }
  neighborhoods: NhoodStats[]
  zoning: ZoningStats[]
  transit_bands: TransitBandStats[]
  transit_bands_rapid_bus?: RapidBusBandStats[]
  /** Four mutually-exclusive transit-tier polygons: rail / rapid-bus / local-bus / poor. */
  transit_tiers: TierStats[]
}

let cached: CrossStats | null = null

/**
 * Fetches the pre-computed cross-stats bundle. Server-side: streams from
 * the local public/ asset via the request URL. Client-side: hits the
 * static asset, browser-cached.
 */
export async function loadCrossStats(baseUrl?: string): Promise<CrossStats | null> {
  if (cached) return cached
  try {
    const url = baseUrl ? `${baseUrl}/cross-stats.json` : '/cross-stats.json'
    const res = await fetch(url, { cache: 'force-cache' })
    if (!res.ok) return null
    cached = (await res.json()) as CrossStats
    return cached
  } catch {
    return null
  }
}

/**
 * Synchronous server-side loader — reads the file directly via fs. Use
 * inside server components / route handlers where async fs is fine.
 */
export async function loadCrossStatsSync(): Promise<CrossStats | null> {
  if (cached) return cached
  try {
    const { promises: fs } = await import('node:fs')
    const path = await import('node:path')
    const buf = await fs.readFile(
      path.join(process.cwd(), 'public', 'cross-stats.json'),
      'utf8',
    )
    cached = JSON.parse(buf) as CrossStats
    return cached
  } catch {
    return null
  }
}

// Pretty formatters used by panels + list views.
export function formatPercent(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (n === 0) return '0%'
  if (n < 0.005) return '<1%'
  return `${Math.round(n * 100)}%`
}

export function sqmToAcres(sqm: number): number {
  return sqm / 4046.8564224
}

export function formatAcres(sqm: number): string {
  if (!Number.isFinite(sqm) || sqm <= 0) return '—'
  const acres = sqmToAcres(sqm)
  if (acres >= 1000) return `${(acres / 1000).toFixed(1)}k ac`
  if (acres >= 100) return `${Math.round(acres)} ac`
  return `${acres.toFixed(1)} ac`
}
