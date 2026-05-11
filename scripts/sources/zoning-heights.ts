import type { Feature, Polygon, MultiPolygon } from 'geojson'
import * as turf from '@turf/turf'

const HEIGHT_DATASET = 'https://data.sfgov.org/resource/h9wh-cg3m.json'

interface HeightRow {
  the_geom?: Polygon | MultiPolygon
  height?: string       // "40-X"
  gen_hght?: string     // "40"
}

/** Parse strings like "40-X", "240-S", "40", or "X" into a structured pair. */
export function parseHeight(s: string): { height_ft?: number; bulk?: string } {
  const m = /^(\d+)?(?:-)?([A-Z]?)?$/.exec(s.trim())
  if (!m) return {}
  const out: { height_ft?: number; bulk?: string } = {}
  if (m[1]) out.height_ft = Number(m[1])
  if (m[2]) out.bulk = m[2]
  return out
}

export interface ZoningHeightRecord {
  code: string
  height_ft?: number
  bulk?: string
}

/** Spatial join: for each zoning polygon, find the height polygon that
 *  contains its centroid. Group by zoning_sim and take the median height. */
export function joinHeightsToZoning(
  zoningPolys: Feature<Polygon | MultiPolygon, { zoning_sim: string }>[],
  heightPolys: Feature<Polygon | MultiPolygon, { height_ft?: number; bulk?: string }>[],
): ZoningHeightRecord[] {
  const byCode = new Map<string, { heights: number[]; bulks: string[] }>()
  for (const z of zoningPolys) {
    const code = z.properties.zoning_sim
    if (!code) continue
    const centroid = turf.centroid(z)
    const hit = heightPolys.find((h) =>
      turf.booleanPointInPolygon(centroid, h as Feature<Polygon | MultiPolygon>),
    )
    const entry = byCode.get(code) ?? { heights: [], bulks: [] }
    if (hit?.properties.height_ft != null) entry.heights.push(hit.properties.height_ft)
    if (hit?.properties.bulk) entry.bulks.push(hit.properties.bulk)
    byCode.set(code, entry)
  }
  const out: ZoningHeightRecord[] = []
  for (const [code, e] of byCode) {
    e.heights.sort((a, b) => a - b)
    const median = e.heights.length > 0 ? e.heights[Math.floor(e.heights.length / 2)] : undefined
    const bulk = e.bulks.length > 0 ? e.bulks[0] : undefined
    out.push({ code, height_ft: median, bulk })
  }
  return out.sort((a, b) => a.code.localeCompare(b.code))
}

export async function fetchHeightPolygons(): Promise<
  Feature<Polygon | MultiPolygon, { height_ft?: number; bulk?: string }>[]
> {
  const headers: Record<string, string> = {}
  if (process.env.DATASF_APP_TOKEN) headers['X-App-Token'] = process.env.DATASF_APP_TOKEN
  const url = `${HEIGHT_DATASET}?$limit=5000&$select=the_geom,height,gen_hght`
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`Height fetch failed: ${res.status}`)
  const rows = (await res.json()) as HeightRow[]
  return rows
    .filter((r): r is HeightRow & { the_geom: Polygon | MultiPolygon } => !!r.the_geom)
    .map((r) => {
      const parsed = parseHeight(r.height ?? '')
      const height_ft = parsed.height_ft ?? (r.gen_hght ? Number(r.gen_hght) : undefined)
      return {
        type: 'Feature' as const,
        geometry: r.the_geom,
        properties: { height_ft, bulk: parsed.bulk },
      }
    })
}
