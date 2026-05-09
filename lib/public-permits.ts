import { fetchBuildingPermits } from './datasf'
import { permitStage, netDelta, useCategory } from './permit-style'

/**
 * Shared public-permits builder. Used by `/api/public/permits.json` and
 * `/api/public/permits.csv`. Refreshed nightly via the cron route; this
 * is just a presentation layer over the cached snapshot.
 */

export interface PublicRow {
  permit_number: string
  address: string
  permit_type: string
  permit_type_definition: string | null
  status: string
  stage: string
  description: string | null
  filed_date: string | null
  issued_date: string | null
  completed_date: string | null
  status_date: string | null
  estimated_cost: string | null
  existing_use: string | null
  proposed_use: string | null
  use_category: string
  existing_units: string | null
  proposed_units: string | null
  homes_delta: number | null
  existing_stories: string | null
  proposed_stories: string | null
  block: string | null
  lot: string | null
  pipeline_status: string | null
  pipeline_status_date: string | null
  latitude: number | null
  longitude: number | null
}

export interface PublicQueryOptions {
  completedYears?: number
  recentMonths?: number
}

export async function buildPublicRows(opts: PublicQueryOptions = {}): Promise<PublicRow[]> {
  const completedYears = clampInt(opts.completedYears ?? 2, 0, 20)
  const recentMonths = clampInt(opts.recentMonths ?? 0, 0, 120)
  const permits = await fetchBuildingPermits(completedYears, recentMonths)
  return permits.map((p) => ({
    permit_number: p.permit_number,
    address: p.address,
    permit_type: p.permit_type,
    permit_type_definition: p.permit_type_definition,
    status: p.status,
    stage: permitStage(p),
    description: p.description,
    filed_date: p.filed_date,
    issued_date: p.issued_date,
    completed_date: p.completed_date,
    status_date: p.status_date,
    estimated_cost: p.estimated_cost,
    existing_use: p.existing_use,
    proposed_use: p.proposed_use,
    use_category: useCategory(p.proposed_use ?? p.existing_use),
    existing_units: p.existing_units,
    proposed_units: p.proposed_units,
    homes_delta: netDelta(p.existing_units, p.proposed_units),
    existing_stories: p.existing_stories,
    proposed_stories: p.proposed_stories,
    block: p.block,
    lot: p.lot,
    pipeline_status: p.pipeline_status,
    pipeline_status_date: p.pipeline_status_date,
    latitude: p.location?.coordinates?.[1] ?? null,
    longitude: p.location?.coordinates?.[0] ?? null,
  }))
}

function clampInt(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min
  return Math.min(max, Math.max(min, Math.floor(v)))
}

export function csvEscape(v: unknown): string {
  if (v == null) return ''
  const s = String(v)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function rowsToCsv(rows: PublicRow[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0]) as (keyof PublicRow)[]
  const headerLine = headers.join(',')
  const dataLines = rows.map((r) => headers.map((h) => csvEscape(r[h])).join(','))
  return [headerLine, ...dataLines].join('\n') + '\n'
}

export const PUBLIC_API_META = {
  source: 'DataSF (i98e-djp9) joined to SF Planning Development Pipeline (6jgi-cpb4)',
  refreshed_nightly: true,
  schema_version: 1,
  docs: 'https://whatsbuildingsf.com/about',
} as const

export const PUBLIC_API_HEADERS = {
  'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400',
  'Access-Control-Allow-Origin': '*',
} as const
