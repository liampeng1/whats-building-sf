import type { MapBounds, Permit, PlanningCase } from './types'

const BASE_URL = 'https://data.sfgov.org/resource'
const PERMITS_DATASET = 'i98e-djp9'
const PLANNING_DATASET = 'qvu5-m3a2'

interface PermitApiRow {
  permit_number: string
  permit_type: string
  permit_type_definition: string | null
  status: string
  description: string | null
  street_number: string | null
  street_name: string | null
  street_suffix: string | null
  filed_date: string | null
  issued_date: string | null
  completed_date: string | null
  location: Permit['location']
}

function headers(): HeadersInit {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (process.env.DATASF_APP_TOKEN) h['X-App-Token'] = process.env.DATASF_APP_TOKEN
  return h
}

function boundsFilter(bounds: MapBounds): string {
  return `within_box(location,${bounds.north},${bounds.west},${bounds.south},${bounds.east})`
}

function permitFromApi(row: PermitApiRow): Permit {
  const address = [row.street_number, row.street_name, row.street_suffix]
    .filter((p): p is string => Boolean(p))
    .join(' ')
  return {
    permit_number: row.permit_number,
    permit_type: row.permit_type,
    permit_type_definition: row.permit_type_definition,
    status: row.status,
    description: row.description,
    address,
    filed_date: row.filed_date,
    issued_date: row.issued_date,
    completed_date: row.completed_date,
    location: row.location,
  }
}

export async function fetchBuildingPermits(bounds?: MapBounds): Promise<Permit[]> {
  const params = new URLSearchParams({ $limit: '500', $order: 'filed_date DESC' })
  if (bounds) params.set('$where', boundsFilter(bounds))
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
  if (rows.length === 0) throw new Error('Permit not found')
  return permitFromApi(rows[0])
}

export async function fetchPlanningCases(): Promise<PlanningCase[]> {
  const params = new URLSearchParams({ $limit: '500', $order: 'open_date DESC' })
  const res = await fetch(`${BASE_URL}/${PLANNING_DATASET}.json?${params}`, { headers: headers() })
  if (!res.ok) throw new Error(`DataSF error: ${res.status}`)
  return res.json()
}

export async function fetchPlanningCase(id: string): Promise<PlanningCase> {
  const params = new URLSearchParams({ record_id: id, $limit: '1' })
  const res = await fetch(`${BASE_URL}/${PLANNING_DATASET}.json?${params}`, { headers: headers() })
  if (!res.ok) throw new Error(`DataSF error: ${res.status}`)
  const data: PlanningCase[] = await res.json()
  if (data.length === 0) throw new Error('Planning case not found')
  return data[0]
}
