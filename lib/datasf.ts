import type { MapBounds, Permit, PlanningCase } from './types'

const BASE_URL = 'https://data.sfgov.org/resource'
const PERMITS_DATASET = 'i98e-djp9'
const PLANNING_DATASET = 'qvu5-m3a2'
const PIPELINE_DATASET = '6jgi-cpb4' // SF Development Pipeline

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
  existing_use?: string | null
  proposed_use?: string | null
  existing_units?: string | null
  proposed_units?: string | null
  number_of_existing_stories?: string | null
  number_of_proposed_stories?: string | null
  block?: string | null
  lot?: string | null
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
    existing_use: row.existing_use ?? null,
    proposed_use: row.proposed_use ?? null,
    existing_units: row.existing_units ?? null,
    proposed_units: row.proposed_units ?? null,
    existing_stories: row.number_of_existing_stories ?? null,
    proposed_stories: row.number_of_proposed_stories ?? null,
    location: row.location ?? null,
    pipeline_status: null,
    pipeline_status_date: null,
    block: row.block ?? null,
    lot: row.lot ?? null,
  }
}

interface DemolitionApiRow {
  permit_number?: string
  filed_date?: string | null
  issued_date?: string | null
  completed_date?: string | null
  status?: string
}

/**
 * Fetch demolition permits (type 6) for a given parcel. Used on the detail
 * page to show demolition history before a new-construction permit.
 *
 * Filters to demos filed within 10 years before the construction's
 * filed_date — a decades-old demo from a previous building cycle isn't
 * relevant to the current project (e.g. 198 Valencia St had a 1989 demo +
 * a 2014 demo; only the 2014 one belongs in the 2014-construction's timeline).
 */
async function fetchDemolitionsForParcel(
  block: string,
  lot: string,
  excludePermitNumber?: string,
  constructionFiledDate?: string | null,
): Promise<import('./types').DemolitionEvent[]> {
  let dateClause: string | null = null
  if (constructionFiledDate) {
    const filed = new Date(constructionFiledDate)
    if (!isNaN(filed.getTime())) {
      const cutoff = new Date(filed)
      cutoff.setFullYear(cutoff.getFullYear() - 10)
      dateClause = `filed_date >= '${cutoff.toISOString().slice(0, 10)}'`
    }
  }
  const where = [
    `permit_type='6'`,
    `block='${block.replace(/'/g, "''")}'`,
    `lot='${lot.replace(/'/g, "''")}'`,
    excludePermitNumber ? `permit_number != '${excludePermitNumber.replace(/'/g, "''")}'` : null,
    dateClause,
  ]
    .filter(Boolean)
    .join(' AND ')
  const params = new URLSearchParams({
    $select: 'permit_number,filed_date,issued_date,completed_date,status',
    $where: where,
    $order: 'filed_date DESC',
    $limit: '5',
  })
  const res = await fetch(`${BASE_URL}/${PERMITS_DATASET}.json?${params}`, {
    headers: headers(),
    next: { revalidate: 3600 },
  })
  if (!res.ok) return []
  const rows: DemolitionApiRow[] = await res.json()
  return rows.map((r) => ({
    permit_number: r.permit_number ?? '',
    filed_date: r.filed_date ?? null,
    issued_date: r.issued_date ?? null,
    completed_date: r.completed_date ?? null,
    status: r.status ?? 'unknown',
  }))
}

interface PipelineRow {
  bpa_no?: string
  current_status?: string
  current_status_date?: string
}

/**
 * Fetch the SF Development Pipeline (6jgi-cpb4) and return a Map keyed by
 * permit number with the curated current_status + status_date. SF Planning
 * marks projects as 'Construction' based on field reports and inspection
 * activity — a better signal than the raw permit status field.
 *
 * Single fetch covers all stages; we filter on the client by current_status.
 */
async function fetchPipelineMap(): Promise<Map<string, { status: string; date: string | null }>> {
  const params = new URLSearchParams({
    $select: 'bpa_no,current_status,current_status_date',
    $where: 'bpa_no IS NOT NULL',
    $limit: '5000',
  })
  const res = await fetch(`${BASE_URL}/${PIPELINE_DATASET}.json?${params}`, {
    headers: headers(),
    next: { revalidate: 3600 }, // pipeline updates daily; 1h cache is plenty
  })
  if (!res.ok) return new Map()
  const rows: PipelineRow[] = await res.json()
  const out = new Map<string, { status: string; date: string | null }>()
  for (const r of rows) {
    if (!r.bpa_no || !r.current_status) continue
    out.set(r.bpa_no, {
      status: r.current_status,
      date: r.current_status_date ?? null,
    })
  }
  return out
}

// Permit type codes that represent major new construction.
// 1 = new construction, 2 = new construction (wood frame).
// Type 3 (additions/alterations/repairs) is excluded — too dominated by minor remodels.
// All other types (signs, demolitions, OTC alterations, grading, etc.) also excluded.
const TRACKED_PERMIT_TYPES = ['1', '2']
const TRACKED_TYPES_FILTER = `permit_type IN (${TRACKED_PERMIT_TYPES.map((t) => `'${t}'`).join(',')})`

// Statuses that mean the permit is dead — never going to progress.
const INACTIVE_STATUSES = [
  'cancelled', 'denied', 'disapproved', 'expired',
  'revoked', 'withdrawn', 'overruled', 'unknown',
]

function isoYearsAgo(years: number, now: Date = new Date()): string {
  const c = new Date(now)
  c.setFullYear(c.getFullYear() - years)
  return c.toISOString().slice(0, 10)
}

/**
 * Build the server-side recency clause.
 *   - "in progress" = not completed AND not in an inactive status
 *   - "recently completed" = completed_date within the last `completedYears`
 * Set `completedYears` to 0 to hide completed entirely.
 */
function recencyFilter(completedYears: number, now: Date = new Date()): string {
  const inactiveList = INACTIVE_STATUSES.map((s) => `'${s}'`).join(',')
  const inProgress = `(completed_date IS NULL AND status NOT IN (${inactiveList}))`
  if (completedYears <= 0) return inProgress
  const completedCutoff = isoYearsAgo(completedYears, now)
  return `(${inProgress} OR completed_date >= '${completedCutoff}')`
}

export async function fetchBuildingPermits(
  bounds?: MapBounds,
  completedYears: number = 2,
): Promise<Permit[]> {
  const params = new URLSearchParams({ $limit: '5000', $order: 'filed_date DESC' })
  const clauses = [TRACKED_TYPES_FILTER, recencyFilter(completedYears)]
  if (bounds) clauses.push(boundsFilter(bounds))
  params.set('$where', clauses.join(' AND '))

  const [permitsRes, pipelineMap] = await Promise.all([
    fetch(`${BASE_URL}/${PERMITS_DATASET}.json?${params}`, { headers: headers() }),
    fetchPipelineMap(),
  ])
  if (!permitsRes.ok) throw new Error(`DataSF error: ${permitsRes.status}`)
  const rows: PermitApiRow[] = await permitsRes.json()
  return rows.map((row) => {
    const p = permitFromApi(row)
    const pipe = pipelineMap.get(p.permit_number)
    if (pipe) {
      p.pipeline_status = pipe.status
      p.pipeline_status_date = pipe.date
    }
    return p
  })
}

export async function fetchBuildingPermit(id: string): Promise<Permit> {
  const params = new URLSearchParams({ permit_number: id, $limit: '1' })
  const pipelineParams = new URLSearchParams({
    $select: 'bpa_no,current_status,current_status_date',
    $where: `bpa_no='${id.replace(/'/g, "''")}'`,
    $limit: '1',
  })
  const [permitRes, pipelineRes] = await Promise.all([
    fetch(`${BASE_URL}/${PERMITS_DATASET}.json?${params}`, { headers: headers() }),
    fetch(`${BASE_URL}/${PIPELINE_DATASET}.json?${pipelineParams}`, {
      headers: headers(),
      next: { revalidate: 3600 },
    }),
  ])
  if (!permitRes.ok) throw new Error(`DataSF error: ${permitRes.status}`)
  const rows: PermitApiRow[] = await permitRes.json()
  if (rows.length === 0) throw new NotFoundError('Permit not found')
  const permit = permitFromApi(rows[0])
  if (pipelineRes.ok) {
    const pipeRows: PipelineRow[] = await pipelineRes.json()
    const p = pipeRows[0]
    if (p?.current_status) {
      permit.pipeline_status = p.current_status
      permit.pipeline_status_date = p.current_status_date ?? null
    }
  }
  if (permit.block && permit.lot) {
    permit.demolitions = await fetchDemolitionsForParcel(
      permit.block,
      permit.lot,
      permit.permit_number,
      permit.filed_date,
    )
  }
  return permit
}

export async function fetchPlanningCases(): Promise<PlanningCase[]> {
  const params = new URLSearchParams({ $limit: '5000', $order: 'open_date DESC' })
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
