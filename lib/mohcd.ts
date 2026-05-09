/**
 * MOHCD pipeline lookup. The Mayor's Office of Housing publishes the
 * affordable / inclusionary housing pipeline at DataSF dataset
 * `aaxw-2cb8`. Joining to DBI permits is by (block, lot), with one wrinkle:
 * MOHCD stores block un-padded (e.g. "337") whereas DBI pads to 4 digits
 * ("0337"). We normalize both sides before comparing.
 */

const MOHCD_DATASET = 'https://data.sfgov.org/resource/aaxw-2cb8.json'

export interface BmrRow {
  project_id: string
  project_name: string
  project_status: string
  construction_status: string | null
  total_project_units: number
  mohcd_affordable_units: number
  affordable_percent: number | null
  // AMI tier → unit count (only the populated tiers)
  ami_breakdown: Record<string, number>
  is_fully_affordable: boolean
  block: string
  lot: string
  address: string
  project_lead_sponsor: string | null
}

interface MohcdRaw {
  project_id?: string
  project_name?: string
  project_status?: string
  construction_status?: string
  block?: string
  lot?: string
  plannning_approval_address?: string
  project_lead_sponsor?: string
  total_project_units?: string
  mohcd_affordable_units?: string
  affordable_percent?: string
  // AMI tiers — schema uses a leading underscore on the numeric keys
  _20_ami?: string
  _30_ami?: string
  _40_ami?: string
  _50_ami?: string
  _55_ami?: string
  _60_ami?: string
  _80_ami?: string
  _90_ami?: string
  _100_ami?: string
  _105_ami?: string
  _110_ami?: string
  _120_ami?: string
  _130_ami?: string
  _150_ami?: string
  ami_undeclared?: string
}

const AMI_KEYS: { tier: string; field: keyof MohcdRaw }[] = [
  { tier: '20', field: '_20_ami' },
  { tier: '30', field: '_30_ami' },
  { tier: '40', field: '_40_ami' },
  { tier: '50', field: '_50_ami' },
  { tier: '55', field: '_55_ami' },
  { tier: '60', field: '_60_ami' },
  { tier: '80', field: '_80_ami' },
  { tier: '90', field: '_90_ami' },
  { tier: '100', field: '_100_ami' },
  { tier: '105', field: '_105_ami' },
  { tier: '110', field: '_110_ami' },
  { tier: '120', field: '_120_ami' },
  { tier: '130', field: '_130_ami' },
  { tier: '150', field: '_150_ami' },
]

/** "337" → "0337", "0337" → "0337", "337A" → "337A" (only zero-pad pure digits). */
export function padBlock(block: string): string {
  if (/^\d+$/.test(block)) return block.padStart(4, '0')
  return block
}

function num(v: string | undefined): number {
  if (v == null) return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function rowFromRaw(r: MohcdRaw): BmrRow | null {
  if (!r.block || !r.lot) return null
  const total = num(r.total_project_units)
  const affordable = num(r.mohcd_affordable_units)
  const pct = r.affordable_percent != null ? Number(r.affordable_percent) : null
  const ami_breakdown: Record<string, number> = {}
  for (const { tier, field } of AMI_KEYS) {
    const c = num(r[field] as string | undefined)
    if (c > 0) ami_breakdown[tier] = c
  }
  return {
    project_id: r.project_id ?? '',
    project_name: r.project_name ?? '',
    project_status: r.project_status ?? '',
    construction_status: r.construction_status ?? null,
    block: padBlock(r.block),
    lot: r.lot,
    address: r.plannning_approval_address ?? '',
    project_lead_sponsor: r.project_lead_sponsor ?? null,
    total_project_units: total,
    mohcd_affordable_units: affordable,
    affordable_percent: pct,
    ami_breakdown,
    is_fully_affordable: total > 0 && affordable / total >= 0.95,
  }
}

/**
 * Fetches MOHCD pipeline and returns a map keyed by `${block}/${lot}` (with
 * block zero-padded to 4 digits to match DBI). Cached for 24h on the edge.
 */
export async function fetchBmrIndex(): Promise<Map<string, BmrRow>> {
  const headers: Record<string, string> = {}
  if (process.env.DATASF_APP_TOKEN) headers['X-App-Token'] = process.env.DATASF_APP_TOKEN
  const url = `${MOHCD_DATASET}?$limit=5000`
  const res = await fetch(url, { headers, next: { revalidate: 86400 } })
  if (!res.ok) throw new Error(`MOHCD fetch failed: ${res.status}`)
  const rows: MohcdRaw[] = await res.json()
  const index = new Map<string, BmrRow>()
  for (const raw of rows) {
    const row = rowFromRaw(raw)
    if (!row) continue
    const key = `${row.block}/${row.lot}`
    // Multiple MOHCD entries can exist per parcel (rare). Prefer the one
    // with a populated project_status over an empty record.
    const existing = index.get(key)
    if (!existing || (!existing.project_status && row.project_status)) {
      index.set(key, row)
    }
  }
  return index
}

export async function fetchBmrForParcel(
  block: string | null,
  lot: string | null,
): Promise<BmrRow | null> {
  if (!block || !lot) return null
  try {
    const index = await fetchBmrIndex()
    return index.get(`${padBlock(block)}/${lot}`) ?? null
  } catch {
    return null
  }
}
