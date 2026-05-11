/**
 * Tiny GTFS-zip parser. Used by BART (bart.gov GTFS) and Caltrain
 * (511.org regional feed) station fetchers. Avoids a heavyweight CSV lib
 * for our 4-column use case.
 */

/** Split a CSV-text line on commas, respecting double-quoted fields. */
function splitLine(line: string): string[] {
  const out: string[] = []
  let buf = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuote && line[i + 1] === '"') { buf += '"'; i++; continue }
      inQuote = !inQuote; continue
    }
    if (c === ',' && !inQuote) { out.push(buf); buf = ''; continue }
    buf += c
  }
  out.push(buf)
  return out
}

/** Parse a CSV string with a header row into an array of records. */
export function parseCsv(csv: string): Record<string, string>[] {
  if (csv.charCodeAt(0) === 0xfeff) csv = csv.slice(1)
  const lines = csv.split(/\r?\n/).filter((l) => l.length > 0)
  if (lines.length < 2) return []
  const header = splitLine(lines[0])
  return lines.slice(1).map((line) => {
    const cells = splitLine(line)
    const rec: Record<string, string> = {}
    for (let i = 0; i < header.length; i++) rec[header[i]] = cells[i] ?? ''
    return rec
  })
}

/**
 * Fetch a GTFS zip from a URL and parse the named .txt files.
 * Returns a map of filename → parsed records.
 */
export async function fetchGtfsZip(
  url: string,
  files: string[],
  fetchInit?: RequestInit,
): Promise<Record<string, Record<string, string>[]>> {
  const res = await fetch(url, fetchInit)
  if (!res.ok) throw new Error(`GTFS fetch ${url} failed: ${res.status}`)
  const buf = new Uint8Array(await res.arrayBuffer())
  const { unzipSync } = await import('fflate')
  const entries = unzipSync(buf, { filter: (f) => files.includes(f.name) })
  const out: Record<string, Record<string, string>[]> = {}
  for (const name of files) {
    const data = entries[name]
    if (!data) throw new Error(`GTFS zip missing ${name}`)
    const text = new TextDecoder().decode(data)
    out[name] = parseCsv(text)
  }
  return out
}

/** Parse GTFS shapes.txt into a map of shape_id → [lng, lat][] sorted by sequence. */
export function parseShapes(csv: string): Map<string, [number, number][]> {
  const rows = parseCsv(csv)
  const grouped = new Map<string, { seq: number; coord: [number, number] }[]>()
  for (const r of rows) {
    const id = r.shape_id
    if (!id) continue
    const lat = Number(r.shape_pt_lat)
    const lng = Number(r.shape_pt_lon)
    const seq = Number(r.shape_pt_sequence)
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(seq)) continue
    if (!grouped.has(id)) grouped.set(id, [])
    grouped.get(id)!.push({ seq, coord: [lng, lat] })
  }
  const out = new Map<string, [number, number][]>()
  for (const [id, points] of grouped) {
    points.sort((a, b) => a.seq - b.seq)
    out.set(id, points.map((p) => p.coord))
  }
  return out
}
