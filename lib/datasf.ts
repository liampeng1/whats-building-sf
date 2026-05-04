import type { MapBounds, Permit, PlanningCase } from './types'

const BASE_URL = 'https://data.sfgov.org/resource'
const PERMITS_DATASET = 'i98e-djp9'
const PLANNING_DATASET = 'qvu5-m3a2'

export class NotFoundError extends Error {}

interface PermitApiRow {
  permit_number?: string
  permit_type?: string
  permit_type_definition?: string | null
  status?: string
  description?: string | null
  street_number?: string | null
  street_name?: string | null
  street_suffix?: string | null
  filed_date?: string | null
  issued_date?: string | null
  completed_date?: string | null
  status_date?: string | null
  estimated_cost?: string | null
  location?: Permit['location']
}

interface PlanningCaseApiRow {
  record_id: string
  record_type: string
  description: string | null
  project_address: string
  record_status: string
  open_date: string | null
  [key: string]: unknown
}

function headers(): HeadersInit {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (process.env.DATASF_APP_TOKEN) h['X-App-Token'] = process.env.DATASF_APP_TOKEN
  return h
}

function boundsFilter(bounds: MapBounds): string {
  return `within_box(location,${bounds.north},${bounds.west},${bounds.south},${bounds.east})`
}

function caseFromApi(row: PlanningCaseApiRow): PlanningCase {
  return {
    record_id: row.record_id,
    record_type: row.record_type,
    description: row.description ?? null,
    project_address: row.project_address,
    record_status: row.record_status,
    open_date: row.open_date ?? null,
  }
}

function permitFromApi(row: PermitApiRow): Permit {
  const address = [row.street_number, row.street_name, row.street_suffix]
    .filter((p): p is string => Boolean(p))
    .join(' ')
  return {
    permit_number: row.permit_number ?? '',
    permit_type: row.permit_type ?? '9',
    permit_type_definition: row.permit_type_definition ?? null,
    status: row.status ?? 'unknown',
    description: row.description ?? null,
    address: address || '(address unavailable)',
    filed_date: row.filed_date ?? null,
    issued_date: row.issued_date ?? null,
    completed_date: row.completed_date ?? null,
    status_date: row.status_date ?? null,
    estimated_cost: row.estimated_cost ?? null,
    location: row.location ?? null,
  }
}

// Permit type codes that represent major new construction.
// 1 = new construction, 2 = new construction (wood frame).
// Type 3 (additions/alterations/repairs) is excluded — too dominated by minor remodels.
// All other types (signs, demolitions, OTC alterations, grading, etc.) also excluded.
const TRACKED_PERMIT_TYPES = ['1', '2']
const TRACKED_TYPES_FILTER = `permit_type IN (${TRACKED_PERMIT_TYPES.map((t) => `'${t}'`).join(',')})`

const RECENCY_YEARS = 2

function recencyFilter(now: Date = new Date()): string {
  const cutoff = new Date(now)
  cutoff.setFullYear(cutoff.getFullYear() - RECENCY_YEARS)
  const iso = cutoff.toISOString().slice(0, 10)
  // Show: anything completed within the recency window OR anything with recent
  // status activity (covers long-running active projects). Excludes old/dead permits.
  return `(completed_date >= '${iso}' OR status_date >= '${iso}')`
}

export async function fetchBuildingPermits(bounds?: MapBounds): Promise<Permit[]> {
  const params = new URLSearchParams({ $limit: '500', $order: 'filed_date DESC' })
  const clauses = [TRACKED_TYPES_FILTER, recencyFilter()]
  if (bounds) clauses.push(boundsFilter(bounds))
  params.set('$where', clauses.join(' AND '))
  const res = await fetch(`${BASE_URL}/${PERMITS_DATASET}.json?${params}`, { headers: headers() })
  if (!res.ok) throw new Error(`DataSF error: ${res.status}`)
  const rows: PermitApiRow[] = await res.json()
  return rows.map(permitFromApi)
}

export async function fetchBuildingPermit(id: string): Promise<Permit> {
  const params = new URLSearchParams({ permit_number: id, $limit: '1' })
  const res = await fetch(`${BASE_URL}/${PERMITS_DATASET}.json?${params}`, { headers: headers() })
  if (!res.ok) throw new Error(`DataSF error: ${res.status}`)
  const rows: PermitApiRow[] = await res.json()
  if (rows.length === 0) throw new NotFoundError('Permit not found')
  return permitFromApi(rows[0])
}

export async function fetchPlanningCases(): Promise<PlanningCase[]> {
  const params = new URLSearchParams({ $limit: '500', $order: 'open_date DESC' })
  const res = await fetch(`${BASE_URL}/${PLANNING_DATASET}.json?${params}`, { headers: headers() })
  if (!res.ok) throw new Error(`DataSF error: ${res.status}`)
  const rows: PlanningCaseApiRow[] = await res.json()
  return rows.map(caseFromApi)
}

export async function fetchPlanningCase(id: string): Promise<PlanningCase> {
  const params = new URLSearchParams({ record_id: id, $limit: '1' })
  const res = await fetch(`${BASE_URL}/${PLANNING_DATASET}.json?${params}`, { headers: headers() })
  if (!res.ok) throw new Error(`DataSF error: ${res.status}`)
  const rows: PlanningCaseApiRow[] = await res.json()
  if (rows.length === 0) throw new NotFoundError('Planning case not found')
  return caseFromApi(rows[0])
}
