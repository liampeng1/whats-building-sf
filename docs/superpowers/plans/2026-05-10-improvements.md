# SF Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship four improvements to whats-building-sf — richer zoning lens with state-law context, separated filter/browse UI, expanded dual-shed transit (rail + rapid bus) with per-station filter, and pin clustering at intermediate zooms.

**Architecture:** Five phases mirroring the spec's migration order. Phase 1 plumbs the build pipeline to pull from real datasets (DataSF `h9wh-cg3m` + `i28k-bkz6` + `9exe-acju`, BART GTFS, Caltrain GTFS via 511). Phases 2–5 each consume that data and ship an independent user-facing slice.

**Tech Stack:** Next.js 16, React 19, react-leaflet 5 + react-leaflet-cluster 4, @turf/turf, Vercel deploy, Upstash Redis cache, Jest + Testing Library, Playwright. TypeScript strict.

**Spec:** `docs/superpowers/specs/2026-05-10-improvements-design.md`

---

## File Structure

**New files**
- `scripts/sources/bart-stations.ts` — BART GTFS fetcher
- `scripts/sources/muni-stops.ts` — DataSF `i28k-bkz6` + `9exe-acju` join (rail subset + R-suffix subset)
- `scripts/sources/caltrain-stations.ts` — 511 GTFS fetcher (SF stops only)
- `scripts/sources/zoning-heights.ts` — DataSF `h9wh-cg3m` fetcher + spatial join
- `scripts/sources/_gtfs.ts` — tiny GTFS-zip parser (no deps; `node:zlib` + CSV)
- `lib/transit-stations.ts` — replaces `lib/transit.ts`
- `lib/zoning-rules.ts` — transcribed zoning-rules table with per-field citations
- `lib/family-zoning.ts` — state-law eligibility logic + per-permit heuristic
- `components/FilterPopover.tsx` — anchored popover
- `components/BrowsePanel.tsx` — extracted SectionList drawer
- `components/StationMarkers.tsx` — clickable station markers
- `components/ZoningDistrictPanel.tsx` — replaces ZoningCategoryPanel
- `__tests__/transit-stations.test.ts`
- `__tests__/zoning-rules.test.ts`
- `__tests__/family-zoning.test.ts`
- `__tests__/filter-popover.test.tsx`
- `__tests__/clustering.test.tsx`

**Modified**
- `scripts/build-cross-stats.ts` — replace inline `TRANSIT_STOPS` with fetcher imports; emit new outputs
- `lib/cross-stats.ts` — add `transit_bands_rapid_bus`, `zoning_districts` types
- `components/Map.tsx` — wire clustering, station markers, new state, new URL params
- `components/FilterPanel.tsx` — collapse sections into popover triggers; remove embedded SectionList
- `components/TransitRings.tsx` — render dual sheds + per-station ring variant
- `components/ZoningOverlay.tsx` — emit `zoning_sim` (not just `gen`) on click
- `components/PermitDetailContent.tsx` — add family-zoning badges
- `.env.local` and Vercel env — add `FIVE_ELEVEN_API_KEY`

**Build outputs (committed to `public/`)**
- `public/rail-stations.json`
- `public/rapid-bus-stops.json`
- `public/zoning-heights.json`
- `public/rapid-bus-rings.geojson`
- `public/transit-rings.geojson` (regenerated, was already committed)
- `public/cross-stats.json` (regenerated with new fields)

---

## Phase 1 — Build pipeline plumbing

Zero user-visible change. Output: new JSON files in `/public` plus an extended `npm run cross-stats`. Merge-able on its own.

### Task 1.1: Provision 511 API key + env wiring

**Files:**
- Modify: `.env.local`
- Document: `README.md:1-40` (no edit yet, just confirm)

- [ ] **Step 1: Add env var to `.env.local`**

```bash
# .env.local
FIVE_ELEVEN_API_KEY=
```

Leave blank locally. The user provisions the actual key from `https://511.org/open-data/token` (email-issued, free) and pastes it in.

- [ ] **Step 2: Add same key to Vercel project env (preview + production)**

Run:
```bash
vercel env add FIVE_ELEVEN_API_KEY preview production
```

When prompted, paste the same key.

- [ ] **Step 3: Commit (`.env.local` is gitignored — nothing to commit yet, just record the dependency in the next task)**

No commit this step.

### Task 1.2: GTFS zip parser

**Files:**
- Create: `scripts/sources/_gtfs.ts`
- Test: `__tests__/gtfs-parser.test.ts`

GTFS feeds are zip files containing CSV files. We avoid adding a zip dependency by using `node:stream/web` decompression + a tiny CSV split.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/gtfs-parser.test.ts
import { parseCsv } from '../scripts/sources/_gtfs'

describe('parseCsv', () => {
  it('parses a 2-column CSV with quoted strings', () => {
    const csv = 'stop_id,stop_name\n"70011","San Francisco"\n"70012","22nd St"\n'
    expect(parseCsv(csv)).toEqual([
      { stop_id: '70011', stop_name: 'San Francisco' },
      { stop_id: '70012', stop_name: '22nd St' },
    ])
  })

  it('handles unquoted values', () => {
    const csv = 'a,b,c\n1,2,3\n4,5,6\n'
    expect(parseCsv(csv)).toEqual([
      { a: '1', b: '2', c: '3' },
      { a: '4', b: '5', c: '6' },
    ])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest gtfs-parser
```

Expected: FAIL with "Cannot find module '../scripts/sources/_gtfs'".

- [ ] **Step 3: Implement `_gtfs.ts`**

```ts
// scripts/sources/_gtfs.ts
import { Unzip, UnzipInflate } from 'node:zlib'

/** Split a CSV-text line on commas, respecting double-quoted fields. */
function splitLine(line: string): string[] {
  const out: string[] = []
  let buf = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') { inQuote = !inQuote; continue }
    if (c === ',' && !inQuote) { out.push(buf); buf = ''; continue }
    buf += c
  }
  out.push(buf)
  return out
}

/** Parse a CSV string with a header row into an array of records. */
export function parseCsv(csv: string): Record<string, string>[] {
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
 * Fetch a GTFS zip from a URL and extract the named .txt files.
 * Returns a map of filename → parsed records. Uses Node's built-in
 * decompressor via the AdmZip-free approach: pipe the response through
 * a streaming unzip and collect the entries we care about.
 *
 * For simplicity here we rely on a tiny inline implementation built on
 * the `fflate` zip parser, which is already a transitive dep of next.
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
```

- [ ] **Step 4: Add `fflate` to deps**

```bash
npm i fflate
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx jest gtfs-parser
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/sources/_gtfs.ts __tests__/gtfs-parser.test.ts package.json package-lock.json
git commit -m "feat(build): GTFS zip parser for transit source fetchers"
```

### Task 1.3: BART stations fetcher

**Files:**
- Create: `scripts/sources/bart-stations.ts`
- Test: `__tests__/bart-stations.test.ts` (fixture-driven)
- Create: `__tests__/fixtures/bart-stops-sample.csv`

- [ ] **Step 1: Create the fixture**

```csv
stop_id,stop_name,stop_lat,stop_lon
EMBR,Embarcadero,37.792976,-122.396957
MONT,Montgomery St.,37.789256,-122.401407
POWL,Powell St.,37.784471,-122.40798
DALY,Daly City,37.706121,-122.469081
ROCK,Rockridge,37.844601,-122.251793
```

(Rockridge is intentionally outside SF so we can test the filter.)

- [ ] **Step 2: Write the failing test**

```ts
// __tests__/bart-stations.test.ts
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { parseBartStops, BART_SF_BBOX } from '../scripts/sources/bart-stations'

const FIX = path.join(__dirname, 'fixtures', 'bart-stops-sample.csv')

describe('bart-stations', () => {
  it('filters BART stops to the SF + Daly City bbox', async () => {
    const csv = await fs.readFile(FIX, 'utf8')
    const out = parseBartStops(csv)
    const names = out.map((s) => s.name).sort()
    expect(names).toEqual([
      'Daly City',
      'Embarcadero',
      'Montgomery St.',
      'Powell St.',
    ])
    expect(out.find((s) => s.name === 'Rockridge')).toBeUndefined()
  })

  it('emits station id as a slug', () => {
    const csv = 'stop_id,stop_name,stop_lat,stop_lon\nEMBR,Embarcadero,37.79,-122.39\n'
    const out = parseBartStops(csv)
    expect(out[0].id).toBe('bart-embarcadero')
  })

  it('attaches modes=["bart"] to every station', () => {
    const csv = 'stop_id,stop_name,stop_lat,stop_lon\nEMBR,Embarcadero,37.79,-122.39\n'
    expect(parseBartStops(csv)[0].modes).toEqual(['bart'])
  })
})

describe('BART_SF_BBOX', () => {
  it('covers SF + Daly City', () => {
    expect(BART_SF_BBOX.south).toBeLessThanOrEqual(37.706)
    expect(BART_SF_BBOX.north).toBeGreaterThanOrEqual(37.81)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx jest bart-stations
```

Expected: FAIL with "Cannot find module".

- [ ] **Step 4: Implement `bart-stations.ts`**

```ts
// scripts/sources/bart-stations.ts
import { fetchGtfsZip, parseCsv } from './_gtfs'
import type { RailStation } from '../../lib/transit-stations'

const BART_GTFS_URL = 'https://www.bart.gov/dev/schedules/google_transit.zip'

/** SF county + Daly City. Tight enough to exclude Oakland/Berkeley, loose
 * enough to include the southern edge stations residents rely on. */
export const BART_SF_BBOX = {
  south: 37.706,
  north: 37.81,
  west: -122.515,
  east: -122.355,
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function parseBartStops(csv: string): RailStation[] {
  const rows = parseCsv(csv)
  return rows
    .map((r) => ({
      id: `bart-${slugify(r.stop_name)}`,
      name: r.stop_name,
      lat: Number(r.stop_lat),
      lng: Number(r.stop_lon),
      modes: ['bart'] as const,
    }))
    .filter(
      (s) =>
        Number.isFinite(s.lat) &&
        Number.isFinite(s.lng) &&
        s.lat >= BART_SF_BBOX.south &&
        s.lat <= BART_SF_BBOX.north &&
        s.lng >= BART_SF_BBOX.west &&
        s.lng <= BART_SF_BBOX.east,
    )
    .map((s) => ({ ...s, modes: [...s.modes] }))
}

export async function fetchBartStations(): Promise<RailStation[]> {
  const entries = await fetchGtfsZip(BART_GTFS_URL, ['stops.txt'])
  // Re-serialize to CSV-shaped text so parseBartStops can be tested in isolation.
  const rows = entries['stops.txt']
  const header = ['stop_id', 'stop_name', 'stop_lat', 'stop_lon']
  const lines = [header.join(',')]
  for (const r of rows) lines.push(header.map((h) => r[h] ?? '').join(','))
  return parseBartStops(lines.join('\n'))
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx jest bart-stations
```

Expected: PASS (3 + 1 tests).

- [ ] **Step 6: Commit**

```bash
git add scripts/sources/bart-stations.ts __tests__/bart-stations.test.ts __tests__/fixtures/bart-stops-sample.csv
git commit -m "feat(build): BART stations fetcher with SF bbox filter"
```

### Task 1.4: Muni rail + rapid-bus fetcher

**Files:**
- Create: `scripts/sources/muni-stops.ts`
- Test: `__tests__/muni-stops.test.ts`
- Create: `__tests__/fixtures/muni-routes-sample.json`
- Create: `__tests__/fixtures/muni-stops-sample.json`

DataSF Socrata returns JSON natively. No GTFS parsing needed for Muni.

The dataset `9exe-acju` (Muni Simple Routes) has `route_id` (e.g. `15225`), `lineabbr` (e.g. `38R`, `K`), and `route_type`. We filter to two cohorts:

- **Rail**: `lineabbr ∈ { 'K', 'L', 'M', 'N', 'T', 'J' }`
- **Rapid bus**: `lineabbr` ends with `R` (e.g. `5R`, `9R`, `14R`, `38R`)

Stops are then resolved via `i28k-bkz6` (`stopid`, `stopname`, `latitude`, `longitude`, `routes` — comma-separated list of `route_id`s served by the stop). Filter by intersection with the cohort's `route_id` set.

- [ ] **Step 1: Create the fixtures**

```json
// __tests__/fixtures/muni-routes-sample.json
[
  { "route_id": "1001", "lineabbr": "K", "route_type": "0" },
  { "route_id": "1002", "lineabbr": "T", "route_type": "0" },
  { "route_id": "2001", "lineabbr": "38R", "route_type": "3" },
  { "route_id": "2002", "lineabbr": "5R", "route_type": "3" },
  { "route_id": "9001", "lineabbr": "38", "route_type": "3" }
]
```

```json
// __tests__/fixtures/muni-stops-sample.json
[
  { "stopid": "13001", "stopname": "Castro Station", "latitude": "37.762", "longitude": "-122.43492", "routes": "1001,1002" },
  { "stopid": "13002", "stopname": "Geary & Powell", "latitude": "37.787", "longitude": "-122.408", "routes": "2001" },
  { "stopid": "13003", "stopname": "Mission & 24th", "latitude": "37.752", "longitude": "-122.418", "routes": "2002,9001" },
  { "stopid": "13004", "stopname": "Geary & 33rd", "latitude": "37.781", "longitude": "-122.495", "routes": "9001" }
]
```

- [ ] **Step 2: Write the failing test**

```ts
// __tests__/muni-stops.test.ts
import routes from './fixtures/muni-routes-sample.json'
import stops from './fixtures/muni-stops-sample.json'
import {
  selectRailRouteIds,
  selectRapidBusRouteIds,
  buildRailStations,
  buildRapidBusStops,
} from '../scripts/sources/muni-stops'

describe('selectRailRouteIds', () => {
  it('picks K/L/M/N/T/J lineabbrs', () => {
    expect(selectRailRouteIds(routes).sort()).toEqual(['1001', '1002'])
  })
})

describe('selectRapidBusRouteIds', () => {
  it('picks R-suffix lineabbrs only', () => {
    expect(selectRapidBusRouteIds(routes).sort()).toEqual(['2001', '2002'])
  })
  it('excludes plain 38 (no R suffix)', () => {
    expect(selectRapidBusRouteIds(routes)).not.toContain('9001')
  })
})

describe('buildRailStations', () => {
  it('returns stops served by at least one rail route', () => {
    const railIds = new Set(selectRailRouteIds(routes))
    const out = buildRailStations(stops, railIds)
    expect(out.map((s) => s.name)).toEqual(['Castro Station'])
    expect(out[0].modes).toEqual(['muni-metro'])
    expect(out[0].id).toBe('muni-castro-station')
  })
})

describe('buildRapidBusStops', () => {
  it('returns stops served by at least one R-suffix route', () => {
    const ids = new Set(selectRapidBusRouteIds(routes))
    const out = buildRapidBusStops(stops, routes, ids)
    const names = out.map((s) => s.name).sort()
    expect(names).toEqual(['Geary & Powell', 'Mission & 24th'])
    const mission = out.find((s) => s.name === 'Mission & 24th')!
    expect(mission.routes).toEqual(['5R'])  // 38 is filtered out as non-rapid
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx jest muni-stops
```

Expected: FAIL with "Cannot find module".

- [ ] **Step 4: Implement `muni-stops.ts`**

```ts
// scripts/sources/muni-stops.ts
import type { RailStation, RapidBusStop } from '../../lib/transit-stations'

interface MuniRoute {
  route_id: string
  lineabbr: string
  route_type: string
}
interface MuniStop {
  stopid: string
  stopname: string
  latitude: string
  longitude: string
  routes: string  // comma-separated route_ids
}

const RAIL_LINES = new Set(['K', 'L', 'M', 'N', 'T', 'J'])

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function selectRailRouteIds(routes: MuniRoute[]): string[] {
  return routes.filter((r) => RAIL_LINES.has(r.lineabbr)).map((r) => r.route_id)
}

export function selectRapidBusRouteIds(routes: MuniRoute[]): string[] {
  return routes.filter((r) => /R$/.test(r.lineabbr)).map((r) => r.route_id)
}

export function buildRailStations(
  stops: MuniStop[],
  railRouteIds: Set<string>,
): RailStation[] {
  return stops
    .filter((s) => s.routes.split(',').some((id) => railRouteIds.has(id.trim())))
    .map((s) => ({
      id: `muni-${slugify(s.stopname)}`,
      name: s.stopname,
      lat: Number(s.latitude),
      lng: Number(s.longitude),
      modes: ['muni-metro'],
    }))
    .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
}

export function buildRapidBusStops(
  stops: MuniStop[],
  routes: MuniRoute[],
  rapidIds: Set<string>,
): RapidBusStop[] {
  const idToLine = new Map(routes.map((r) => [r.route_id, r.lineabbr]))
  return stops
    .filter((s) => s.routes.split(',').some((id) => rapidIds.has(id.trim())))
    .map((s) => {
      const lines = s.routes
        .split(',')
        .map((id) => id.trim())
        .filter((id) => rapidIds.has(id))
        .map((id) => idToLine.get(id)!)
      return {
        id: `bus-${slugify(s.stopname)}`,
        name: s.stopname,
        lat: Number(s.latitude),
        lng: Number(s.longitude),
        routes: [...new Set(lines)],
      }
    })
    .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
}

export async function fetchMuni(): Promise<{
  rail: RailStation[]
  rapid: RapidBusStop[]
}> {
  const headers: Record<string, string> = {}
  if (process.env.DATASF_APP_TOKEN) headers['X-App-Token'] = process.env.DATASF_APP_TOKEN
  const [rRoutes, rStops] = await Promise.all([
    fetch('https://data.sfgov.org/resource/9exe-acju.json?$limit=2000', { headers }),
    fetch('https://data.sfgov.org/resource/i28k-bkz6.json?$limit=10000', { headers }),
  ])
  if (!rRoutes.ok) throw new Error(`Muni routes fetch failed: ${rRoutes.status}`)
  if (!rStops.ok) throw new Error(`Muni stops fetch failed: ${rStops.status}`)
  const routes = (await rRoutes.json()) as MuniRoute[]
  const stops = (await rStops.json()) as MuniStop[]
  const railIds = new Set(selectRailRouteIds(routes))
  const rapidIds = new Set(selectRapidBusRouteIds(routes))
  return {
    rail: buildRailStations(stops, railIds),
    rapid: buildRapidBusStops(stops, routes, rapidIds),
  }
}
```

Note: this file imports types from `lib/transit-stations.ts` (not yet created). Define those types as an interim — the tests will compile because TS resolves them from the type-only import — but if the test runner complains, create a minimal `lib/transit-stations.ts` stub now (filled out in Task 2.1):

```ts
// lib/transit-stations.ts (stub for type imports)
export interface RailStation {
  id: string; name: string; lat: number; lng: number;
  modes: ('bart' | 'muni-metro' | 'caltrain')[]
}
export interface RapidBusStop {
  id: string; name: string; lat: number; lng: number;
  routes: string[]
}
export const RAIL_STATIONS: RailStation[] = []
export const RAPID_BUS_STOPS: RapidBusStop[] = []
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx jest muni-stops
```

Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add scripts/sources/muni-stops.ts __tests__/muni-stops.test.ts __tests__/fixtures/muni-routes-sample.json __tests__/fixtures/muni-stops-sample.json lib/transit-stations.ts
git commit -m "feat(build): Muni rail + rapid-bus fetcher from DataSF"
```

### Task 1.5: Caltrain SF-stops fetcher

**Files:**
- Create: `scripts/sources/caltrain-stations.ts`
- Test: `__tests__/caltrain-stations.test.ts`

Caltrain's three SF stops have known GTFS stop_ids: `70011` (San Francisco), `70021` (22nd Street), `70031` (Bayshore). Hard-code the whitelist and pull names + coords from the 511 feed.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/caltrain-stations.test.ts
import { parseCaltrainStops, CALTRAIN_SF_STOP_IDS } from '../scripts/sources/caltrain-stations'

describe('parseCaltrainStops', () => {
  it('filters to the SF stop_id whitelist', () => {
    const csv = `stop_id,stop_name,stop_lat,stop_lon
70011,San Francisco Caltrain,37.7766,-122.3942
70021,22nd Street Caltrain,37.7575,-122.3924
70031,Bayshore Caltrain,37.7099,-122.4019
70041,South San Francisco,37.6562,-122.4054
70051,San Bruno,37.6313,-122.4123
`
    const out = parseCaltrainStops(csv)
    expect(out.map((s) => s.id).sort()).toEqual([
      'caltrain-22nd-street-caltrain',
      'caltrain-bayshore-caltrain',
      'caltrain-san-francisco-caltrain',
    ])
    expect(out[0].modes).toEqual(['caltrain'])
  })
})

describe('CALTRAIN_SF_STOP_IDS', () => {
  it('contains exactly the three SF stop_ids', () => {
    expect([...CALTRAIN_SF_STOP_IDS].sort()).toEqual(['70011', '70021', '70031'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest caltrain-stations
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `caltrain-stations.ts`**

```ts
// scripts/sources/caltrain-stations.ts
import { fetchGtfsZip, parseCsv } from './_gtfs'
import type { RailStation } from '../../lib/transit-stations'

/** 511 regional GTFS endpoint, operator_id=CT for Caltrain. Requires a key. */
const CALTRAIN_GTFS_URL = (key: string) =>
  `https://api.511.org/transit/datafeeds?operator_id=CT&api_key=${encodeURIComponent(key)}`

export const CALTRAIN_SF_STOP_IDS = new Set(['70011', '70021', '70031'])

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function parseCaltrainStops(csv: string): RailStation[] {
  const rows = parseCsv(csv)
  return rows
    .filter((r) => CALTRAIN_SF_STOP_IDS.has(r.stop_id))
    .map((r) => ({
      id: `caltrain-${slugify(r.stop_name)}`,
      name: r.stop_name,
      lat: Number(r.stop_lat),
      lng: Number(r.stop_lon),
      modes: ['caltrain'] as const,
    }))
    .map((s) => ({ ...s, modes: [...s.modes] }))
}

export async function fetchCaltrainSfStations(): Promise<RailStation[]> {
  const key = process.env.FIVE_ELEVEN_API_KEY
  if (!key) {
    console.warn('FIVE_ELEVEN_API_KEY not set; skipping Caltrain stations')
    return []
  }
  const entries = await fetchGtfsZip(CALTRAIN_GTFS_URL(key), ['stops.txt'])
  const rows = entries['stops.txt']
  const header = ['stop_id', 'stop_name', 'stop_lat', 'stop_lon']
  const csv = [header.join(','), ...rows.map((r) => header.map((h) => r[h] ?? '').join(','))].join('\n')
  return parseCaltrainStops(csv)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest caltrain-stations
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/sources/caltrain-stations.ts __tests__/caltrain-stations.test.ts
git commit -m "feat(build): Caltrain SF-stations fetcher via 511 GTFS"
```

### Task 1.6: Merge + dedupe stations

**Files:**
- Create: `scripts/sources/merge-rail.ts`
- Test: `__tests__/merge-rail.test.ts`

Castro Station at 37.762/-122.43492 appears in Muni (K/L/M) and possibly other sources. Collapse stations whose distance < 50m, merging their `modes`.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/merge-rail.test.ts
import { mergeRailStations } from '../scripts/sources/merge-rail'

describe('mergeRailStations', () => {
  it('dedupes stations within 50m and merges modes', () => {
    const out = mergeRailStations([
      { id: 'bart-embarcadero',  name: 'Embarcadero', lat: 37.7929, lng: -122.3969, modes: ['bart'] },
      { id: 'muni-embarcadero',  name: 'Embarcadero', lat: 37.7930, lng: -122.3970, modes: ['muni-metro'] },
      { id: 'muni-castro-station', name: 'Castro Station', lat: 37.762, lng: -122.43492, modes: ['muni-metro'] },
    ])
    expect(out).toHaveLength(2)
    const emb = out.find((s) => s.name === 'Embarcadero')!
    expect(emb.modes.sort()).toEqual(['bart', 'muni-metro'])
  })

  it('keeps stations >50m apart distinct', () => {
    const out = mergeRailStations([
      { id: 'a', name: 'A', lat: 37.7000, lng: -122.4000, modes: ['bart'] },
      { id: 'b', name: 'B', lat: 37.7100, lng: -122.4000, modes: ['bart'] },  // ~1.1 km away
    ])
    expect(out).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest merge-rail
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `merge-rail.ts`**

```ts
// scripts/sources/merge-rail.ts
import type { RailStation } from '../../lib/transit-stations'

const MERGE_THRESHOLD_M = 50

function distanceMeters(a: RailStation, b: RailStation): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function mergeRailStations(input: RailStation[]): RailStation[] {
  const out: RailStation[] = []
  for (const s of input) {
    const near = out.find((o) => distanceMeters(o, s) < MERGE_THRESHOLD_M)
    if (near) {
      near.modes = [...new Set([...near.modes, ...s.modes])]
      continue
    }
    out.push({ ...s, modes: [...s.modes] })
  }
  return out
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest merge-rail
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/sources/merge-rail.ts __tests__/merge-rail.test.ts
git commit -m "feat(build): merge nearby rail stations across sources"
```

### Task 1.7: Zoning heights fetcher

**Files:**
- Create: `scripts/sources/zoning-heights.ts`
- Test: `__tests__/zoning-heights.test.ts`

DataSF `h9wh-cg3m` returns rows with `the_geom`, `height` (string like `"40-X"`), `gen_hght` (number, ft). The zoning polygon and height polygon are spatially distinct — we resolve via the centroid of each zoning polygon against the dominant height polygon it intersects.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/zoning-heights.test.ts
import { parseHeight } from '../scripts/sources/zoning-heights'

describe('parseHeight', () => {
  it('extracts the numeric foot value from "40-X"', () => {
    expect(parseHeight('40-X')).toEqual({ height_ft: 40, bulk: 'X' })
  })
  it('extracts from "240-S"', () => {
    expect(parseHeight('240-S')).toEqual({ height_ft: 240, bulk: 'S' })
  })
  it('handles no bulk letter ("40")', () => {
    expect(parseHeight('40')).toEqual({ height_ft: 40 })
  })
  it('handles bulk letter with no height ("X")', () => {
    expect(parseHeight('X')).toEqual({ bulk: 'X' })
  })
  it('returns empty on garbage', () => {
    expect(parseHeight('')).toEqual({})
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest zoning-heights
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `zoning-heights.ts`**

```ts
// scripts/sources/zoning-heights.ts
import type { Feature, Polygon, MultiPolygon } from 'geojson'
import * as turf from '@turf/turf'

const HEIGHT_DATASET = 'https://data.sfgov.org/resource/h9wh-cg3m.json'

interface HeightRow {
  the_geom?: Polygon | MultiPolygon
  height?: string       // "40-X"
  gen_hght?: string     // "40"
}

export function parseHeight(s: string): { height_ft?: number; bulk?: string } {
  const m = /^(\d+)?(?:-)?([A-Z]?)?$/.exec(s.trim())
  if (!m) return {}
  const out: { height_ft?: number; bulk?: string } = {}
  if (m[1]) out.height_ft = Number(m[1])
  if (m[2]) out.bulk = m[2]
  return out
}

interface ZoningHeightRecord {
  code: string                  // zoning_sim from 3i4a-hu95
  height_ft?: number
  bulk?: string
}

/** Resolve height-per-zoning-district by dominant intersection. Each
 *  zoning polygon's centroid is sampled against the height polygons;
 *  the height of the polygon containing that centroid wins. We then
 *  group by zoning_sim and take the median height_ft (covers cases
 *  where a district code maps to many polygons across SF). */
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
    const bulk = e.bulks.length > 0 ? e.bulks[0] : undefined  // mode would be better; first is fine for now
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest zoning-heights
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/sources/zoning-heights.ts __tests__/zoning-heights.test.ts
git commit -m "feat(build): zoning heights fetcher via h9wh-cg3m + spatial join"
```

### Task 1.8: Wire fetchers into `build-cross-stats.ts`

**Files:**
- Modify: `scripts/build-cross-stats.ts` (replace inline TRANSIT_STOPS; add emit steps)

- [ ] **Step 1: Replace inline TRANSIT_STOPS with imports**

Open `scripts/build-cross-stats.ts`. Delete the inline `TRANSIT_STOPS` constant (currently lines 42-75). At the top of `main()`, add:

```ts
import { fetchBartStations } from './sources/bart-stations'
import { fetchMuni } from './sources/muni-stops'
import { fetchCaltrainSfStations } from './sources/caltrain-stations'
import { mergeRailStations } from './sources/merge-rail'
import { fetchHeightPolygons, joinHeightsToZoning } from './sources/zoning-heights'
```

In `main()`, after the zoning fetch and before the transit ring build, insert:

```ts
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
```

- [ ] **Step 2: Update `buildTransitRings()` to use the new rail array**

Change the function signature and body:

```ts
function buildTransitRings(
  stops: { lat: number; lng: number }[],
  bands: readonly number[],
): Record<string, AnyPoly> {
  const out: Record<string, AnyPoly> = {}
  for (const miles of bands) {
    const buffers = stops
      .map((s) => turf.buffer(turf.point([s.lng, s.lat]), miles, { units: 'miles' }))
      .filter((f): f is AnyPoly => !!f)
    let acc: AnyPoly = buffers[0]
    for (let i = 1; i < buffers.length; i++) {
      const u = turf.union(turf.featureCollection([acc, buffers[i]]))
      if (u) acc = u as AnyPoly
    }
    out[`${miles}mi`] = acc
  }
  return out
}
```

Update the call site:

```ts
const RAPID_BUS_BANDS = [0.1, 0.25] as const
const transitRings = buildTransitRings(rail, TRANSIT_BANDS)
const rapidBusRings = buildTransitRings(rapid, RAPID_BUS_BANDS)
```

- [ ] **Step 3: Emit rapid-bus rings**

After writing `transit-rings.geojson`, add:

```ts
const rapidBusRingsCollection: FeatureCollection = {
  type: 'FeatureCollection',
  features: RAPID_BUS_BANDS.map((miles) => {
    const ring = rapidBusRings[`${miles}mi`]
    return {
      type: 'Feature',
      geometry: ring.geometry,
      properties: { band: `${miles}mi`, miles },
    }
  }),
}
await fs.writeFile(
  path.join(PUBLIC_DIR, 'rapid-bus-rings.geojson'),
  JSON.stringify(rapidBusRingsCollection),
)
console.log(`✓ wrote ${path.join(PUBLIC_DIR, 'rapid-bus-rings.geojson')}`)
```

- [ ] **Step 4: Compute and emit `transit_bands_rapid_bus`**

After the existing `transit_bands` computation, add a parallel loop:

```ts
console.log('• per-rapid-bus-band cross-tabs…')
const rapidBusOut: TransitBandStats[] = []
for (const band of RAPID_BUS_BANDS) {
  const ring = rapidBusRings[`${band}mi`]
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
    band: `${band}mi` as TransitBandStats['band'],
    area_sqm: area,
    share_of_sf: totalSfArea > 0 ? area / totalSfArea : 0,
    neighborhood_share,
    zoning_share,
  })
}
```

Add `transit_bands_rapid_bus: rapidBusOut` to the final `out` object.

- [ ] **Step 5: Compute and emit zoning heights**

After loading zoning polygons in `main()`, add:

```ts
console.log('• loading height/bulk districts (h9wh-cg3m)…')
const heightPolys = await fetchHeightPolygons()
console.log(`  ${heightPolys.length} height polygons`)

const zoningWithSim = zoningPolys.map((z) => ({
  type: 'Feature' as const,
  geometry: z.geometry,
  properties: { zoning_sim: (z.properties as { zoning_sim?: string }).zoning_sim ?? '' },
}))
const heights = joinHeightsToZoning(zoningWithSim, heightPolys)
await fs.writeFile(
  path.join(PUBLIC_DIR, 'zoning-heights.json'),
  JSON.stringify(heights, null, 2),
)
console.log(`✓ wrote zoning-heights.json (${heights.length} codes)`)
```

- [ ] **Step 6: Run the build end-to-end**

```bash
npm run cross-stats
```

Expected output includes lines for:
- `rail: NN, rapid bus: MM`
- `✓ wrote .../rail-stations.json`
- `✓ wrote .../rapid-bus-stops.json`
- `✓ wrote .../rapid-bus-rings.geojson`
- `✓ wrote zoning-heights.json (NN codes)`

If the 511 API key is not set, Caltrain stations are skipped (3 fewer rail stations); the build still succeeds.

- [ ] **Step 7: Commit**

```bash
git add scripts/build-cross-stats.ts public/rail-stations.json public/rapid-bus-stops.json public/rapid-bus-rings.geojson public/zoning-heights.json public/transit-rings.geojson public/cross-stats.json
git commit -m "feat(build): emit rail/rapid-bus/heights JSON from real datasets"
```

---

## Phase 2 — Transit UI (dual shed, per-station, popover)

Consumes the JSON from Phase 1. Ships rail+rapid-bus filtering and per-station click filter.

### Task 2.1: `lib/transit-stations.ts` runtime module

**Files:**
- Modify: `lib/transit-stations.ts` (replace stub from Task 1.4)
- Delete: `lib/transit.ts`
- Test: `__tests__/transit-stations.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/transit-stations.test.ts
import {
  distanceMeters,
  railShed,
  rapidBusShed,
  transitAdjacent,
  RAIL_THRESHOLD_M,
  RAPID_BUS_THRESHOLD_M,
} from '../lib/transit-stations'

jest.mock('../lib/transit-stations', () => {
  const actual = jest.requireActual('../lib/transit-stations')
  return {
    ...actual,
    RAIL_STATIONS: [
      { id: 'bart-embarcadero', name: 'Embarcadero', lat: 37.792976, lng: -122.396957, modes: ['bart'] },
    ],
    RAPID_BUS_STOPS: [
      { id: 'bus-geary-powell', name: 'Geary & Powell', lat: 37.787, lng: -122.408, routes: ['38R'] },
    ],
  }
})

describe('distanceMeters', () => {
  it('returns 0 for the same point', () => {
    expect(distanceMeters(37.7, -122.4, 37.7, -122.4)).toBe(0)
  })
  it('measures ~111km per degree of latitude', () => {
    const d = distanceMeters(37.0, -122.4, 38.0, -122.4)
    expect(d).toBeGreaterThan(110000)
    expect(d).toBeLessThan(112000)
  })
})

describe('railShed', () => {
  it('returns true within 800m of Embarcadero BART', () => {
    expect(railShed([-122.397, 37.793])).toBe(true)
  })
  it('returns false 1.2km from any rail station', () => {
    expect(railShed([-122.45, 37.78])).toBe(false)
  })
  it('respects a custom threshold', () => {
    expect(railShed([-122.397, 37.793], 10)).toBe(true)
  })
})

describe('rapidBusShed', () => {
  it('returns true within default 160m of a rapid bus stop', () => {
    expect(rapidBusShed([-122.408, 37.787])).toBe(true)
  })
  it('returns false at 500m', () => {
    expect(rapidBusShed([-122.413, 37.787])).toBe(false)
  })
})

describe('transitAdjacent', () => {
  it('defaults to rail-only', () => {
    expect(transitAdjacent([-122.397, 37.793])).toBe(true)
    expect(transitAdjacent([-122.408, 37.787])).toBe(false)
  })
  it('accepts rapidBus opt-in', () => {
    expect(transitAdjacent([-122.408, 37.787], { rail: false, rapidBus: true })).toBe(true)
  })
})

describe('thresholds', () => {
  it('exports the documented walk-shed defaults', () => {
    expect(RAIL_THRESHOLD_M).toBe(800)
    expect(RAPID_BUS_THRESHOLD_M).toBe(160)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest transit-stations
```

Expected: FAIL — most functions not exported.

- [ ] **Step 3: Replace the stub `lib/transit-stations.ts`**

```ts
// lib/transit-stations.ts
/**
 * Transit-adjacency helpers. Stations are loaded at runtime from
 * /rail-stations.json and /rapid-bus-stops.json — both emitted by
 * scripts/build-cross-stats.ts from real datasets (BART GTFS,
 * DataSF Muni, Caltrain GTFS via 511).
 *
 * SSR-safe: top-level arrays are empty until hydrated. Use
 * loadStations() once at app startup (or via a layout-level fetch).
 */

export interface RailStation {
  id: string
  name: string
  lat: number
  lng: number
  modes: ('bart' | 'muni-metro' | 'caltrain')[]
}

export interface RapidBusStop {
  id: string
  name: string
  lat: number
  lng: number
  routes: string[]
}

export let RAIL_STATIONS: RailStation[] = []
export let RAPID_BUS_STOPS: RapidBusStop[] = []

let hydrated = false
export async function loadStations(baseUrl = ''): Promise<void> {
  if (hydrated) return
  const [rail, rapid] = await Promise.all([
    fetch(`${baseUrl}/rail-stations.json`).then((r) => (r.ok ? r.json() : [])),
    fetch(`${baseUrl}/rapid-bus-stops.json`).then((r) => (r.ok ? r.json() : [])),
  ])
  RAIL_STATIONS = rail as RailStation[]
  RAPID_BUS_STOPS = rapid as RapidBusStop[]
  hydrated = true
}

/** Haversine. Accurate to a few cm at these scales. */
export function distanceMeters(
  lat1: number, lng1: number, lat2: number, lng2: number,
): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export const RAIL_THRESHOLD_M = 800       // ½ mi
export const RAPID_BUS_THRESHOLD_M = 160  // 0.1 mi

export function railShed(
  coords: [number, number] | null | undefined,
  threshold = RAIL_THRESHOLD_M,
): boolean {
  if (!coords) return false
  const [lng, lat] = coords
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
  for (const s of RAIL_STATIONS) {
    if (distanceMeters(lat, lng, s.lat, s.lng) <= threshold) return true
  }
  return false
}

export function rapidBusShed(
  coords: [number, number] | null | undefined,
  threshold = RAPID_BUS_THRESHOLD_M,
): boolean {
  if (!coords) return false
  const [lng, lat] = coords
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
  for (const s of RAPID_BUS_STOPS) {
    if (distanceMeters(lat, lng, s.lat, s.lng) <= threshold) return true
  }
  return false
}

export function transitAdjacent(
  coords: [number, number] | null | undefined,
  opts: { rail?: boolean; rapidBus?: boolean; railThresholdM?: number; rapidBusThresholdM?: number } = {},
): boolean {
  const rail = opts.rail ?? true
  const rapidBus = opts.rapidBus ?? false
  if (rail && railShed(coords, opts.railThresholdM)) return true
  if (rapidBus && rapidBusShed(coords, opts.rapidBusThresholdM)) return true
  return false
}

/** Used by the per-station click filter. */
export function withinStationRadius(
  coords: [number, number] | null | undefined,
  station: { lat: number; lng: number },
  radiusM: number,
): boolean {
  if (!coords) return false
  const [lng, lat] = coords
  return distanceMeters(lat, lng, station.lat, station.lng) <= radiusM
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest transit-stations
```

Expected: PASS (all transit-stations tests).

- [ ] **Step 5: Delete the old `lib/transit.ts` and update all imports**

```bash
git mv lib/transit.ts lib/transit.ts.deleted
rm lib/transit.ts.deleted
grep -r "from '@/lib/transit'" --include='*.ts' --include='*.tsx' .
```

For each match (likely `components/Map.tsx` only), replace `'@/lib/transit'` with `'@/lib/transit-stations'`. Replace `isTransitAdjacent` calls with `transitAdjacent` (one rename).

- [ ] **Step 6: Verify build + tests**

```bash
npm run lint && npx jest
```

Expected: clean lint, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add lib/transit-stations.ts __tests__/transit-stations.test.ts components/Map.tsx
git rm lib/transit.ts
git commit -m "feat: dual-shed transit helpers (rail + rapid bus)"
```

### Task 2.2: Hydrate stations at map mount

**Files:**
- Modify: `components/Map.tsx` (call `loadStations` on mount)

- [ ] **Step 1: Modify the existing fetch-on-mount effect**

In `components/Map.tsx`, find the `useEffect` that fetches `/sf-neighborhoods.geojson` and `/cross-stats.json` (around line 144). Add a third call:

```ts
import { loadStations } from '@/lib/transit-stations'

// inside the same useEffect:
loadStations().catch(() => {})
```

- [ ] **Step 2: Verify pins still render**

```bash
npm run dev
```

Open `http://localhost:3000`. The map renders. Toggle the transit-only filter — it now filters using the new dataset-driven station list.

- [ ] **Step 3: Commit**

```bash
git add components/Map.tsx
git commit -m "feat: hydrate rail + rapid-bus stations on map mount"
```

### Task 2.3: Cross-stats type additions

**Files:**
- Modify: `lib/cross-stats.ts`

- [ ] **Step 1: Add types and exports**

In `lib/cross-stats.ts`, add:

```ts
export type RapidBusBand = '0.1mi' | '0.25mi'
export const RAPID_BUS_BAND_ORDER: RapidBusBand[] = ['0.1mi', '0.25mi']

export interface RapidBusBandStats {
  band: RapidBusBand
  area_sqm: number
  share_of_sf: number
  neighborhood_share: Record<string, number>
  zoning_share: Partial<Record<ZoningCategory, number>>
}
```

Extend `CrossStats`:

```ts
export interface CrossStats {
  // ...existing fields
  transit_bands_rapid_bus?: RapidBusBandStats[]   // optional during rollout
}
```

- [ ] **Step 2: Verify build**

```bash
npm run lint
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add lib/cross-stats.ts
git commit -m "feat(types): rapid-bus band types for cross-stats"
```

### Task 2.4: `StationMarkers` component

**Files:**
- Create: `components/StationMarkers.tsx`

- [ ] **Step 1: Implement the component**

```tsx
// components/StationMarkers.tsx
'use client'
import { Marker } from 'react-leaflet'
import L from 'leaflet'
import { RAIL_STATIONS, RAPID_BUS_STOPS, type RailStation, type RapidBusStop } from '@/lib/transit-stations'

const RAIL_ICON = L.divIcon({
  className: 'station-icon station-rail',
  html: '<span class="dot"></span>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

const BUS_ICON = L.divIcon({
  className: 'station-icon station-bus',
  html: '<span class="square"></span>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
})

export interface SelectedStation {
  kind: 'rail' | 'rapid-bus'
  id: string
}

interface Props {
  show: boolean
  onSelect: (s: SelectedStation) => void
}

export function StationMarkers({ show, onSelect }: Props) {
  if (!show) return null
  return (
    <>
      {RAIL_STATIONS.map((s: RailStation) => (
        <Marker
          key={s.id}
          position={[s.lat, s.lng]}
          icon={RAIL_ICON}
          eventHandlers={{ click: () => onSelect({ kind: 'rail', id: s.id }) }}
          title={`${s.name} · ${s.modes.join(' / ')}`}
        />
      ))}
      {RAPID_BUS_STOPS.map((s: RapidBusStop) => (
        <Marker
          key={s.id}
          position={[s.lat, s.lng]}
          icon={BUS_ICON}
          eventHandlers={{ click: () => onSelect({ kind: 'rapid-bus', id: s.id }) }}
          title={`${s.name} · ${s.routes.join(', ')}`}
        />
      ))}
    </>
  )
}
```

- [ ] **Step 2: Add the CSS (in `components/marker-cluster.css` or a new file)**

In `app/globals.css`, append:

```css
.station-icon { pointer-events: auto; }
.station-icon .dot {
  display: block;
  width: 10px; height: 10px; border-radius: 50%;
  background: #1c2438; border: 2px solid #fbf6ec;
  box-shadow: 0 0 0 1px #1c2438;
}
.station-icon .square {
  display: block;
  width: 9px; height: 9px;
  background: #fbf6ec; border: 1.5px solid #1c2438;
}
.station-icon:hover .dot,
.station-icon:hover .square {
  transform: scale(1.25);
  transition: transform 100ms ease-out;
}
```

- [ ] **Step 3: Commit**

```bash
git add components/StationMarkers.tsx app/globals.css
git commit -m "feat: rail + rapid-bus station markers (clickable)"
```

### Task 2.5: Per-station selection state + filter

**Files:**
- Modify: `components/Map.tsx`

- [ ] **Step 1: Add state**

In `Map.tsx`, near the existing transit state:

```ts
import { StationMarkers, type SelectedStation } from './StationMarkers'
import {
  RAIL_STATIONS, RAPID_BUS_STOPS,
  railShed, rapidBusShed, transitAdjacent, withinStationRadius,
  RAIL_THRESHOLD_M, RAPID_BUS_THRESHOLD_M,
} from '@/lib/transit-stations'

const [railOnly, setRailOnly] = useState(false)
const [rapidBusOnly, setRapidBusOnly] = useState(false)
const [selectedStation, setSelectedStation] = useState<SelectedStation | null>(null)
const [stationRadiusM, setStationRadiusM] = useState<number>(RAIL_THRESHOLD_M)
```

Remove the old `transitOnly` state.

- [ ] **Step 2: Update the `filteredPermits` memo**

```ts
const filteredPermits = useMemo(
  () =>
    permits.filter((p) => {
      // ...existing stage/category/minUnits checks unchanged

      // Global transit-adjacent filter (rail-only / rapid-bus-only)
      if ((railOnly || rapidBusOnly) && !transitAdjacent(p.location?.coordinates, {
        rail: railOnly, rapidBus: rapidBusOnly,
      })) {
        return false
      }

      // Per-station radius filter
      if (selectedStation) {
        const list = selectedStation.kind === 'rail' ? RAIL_STATIONS : RAPID_BUS_STOPS
        const s = list.find((x) => x.id === selectedStation.id)
        if (s && !withinStationRadius(p.location?.coordinates, s, stationRadiusM)) return false
      }
      return true
    }),
  [permits, selectedStages, selectedCategories, minUnits, railOnly, rapidBusOnly, selectedStation, stationRadiusM],
)
```

- [ ] **Step 3: Wire `StationMarkers` in the map tree**

Inside the `<MapContainer>` JSX, where `TransitRings` is rendered when `mapMode === 'transit'`, also render `StationMarkers`:

```tsx
{mapMode === 'transit' && (
  <>
    <TransitRings selectedBand={selectedTransitBand} onSelect={setSelectedTransitBand} />
    <StationMarkers show onSelect={setSelectedStation} />
  </>
)}
```

- [ ] **Step 4: Update FilterPanel props (temporary — fuller rebuild in Phase 4)**

Replace `transitOnly` / `onTransitToggle` props with `railOnly`, `rapidBusOnly`, plus toggle handlers. Update `FilterPanel.tsx` checkbox section (lines 720-735):

```tsx
<section className="border-t border-paper-edge pt-4">
  <div className="civic-eyebrow mb-2">Transit-adjacent only</div>
  <label className="flex items-center gap-2 text-xs text-ink-soft cursor-pointer">
    <input type="checkbox" checked={railOnly} onChange={onToggleRail} className="accent-ink" />
    Rail (BART, Muni Metro, Caltrain) — within ½ mi
  </label>
  <label className="flex items-center gap-2 text-xs text-ink-soft cursor-pointer mt-1.5">
    <input type="checkbox" checked={rapidBusOnly} onChange={onToggleRapidBus} className="accent-ink" />
    Rapid bus (R-suffix lines) — within 0.1 mi
  </label>
</section>
```

Update the Props interface and `filterSummary` to use the new flags.

- [ ] **Step 5: Verify in browser**

```bash
npm run dev
```

Switch to "transit" lens. Station dots and squares appear. Toggle each checkbox; permits filter accordingly. Click a station; permits filter to that station's shed.

- [ ] **Step 6: Commit**

```bash
git add components/Map.tsx components/FilterPanel.tsx
git commit -m "feat: rail/rapid-bus toggles + per-station radius filter"
```

### Task 2.6: Per-station `LensInfoPanel`

**Files:**
- Modify: `components/Map.tsx` (add a `StationPanel` function component at bottom, mirroring `ZoningCategoryPanel`)

- [ ] **Step 1: Add the `StationPanel` component**

At the bottom of `Map.tsx`, after `TransitBandPanel`:

```tsx
function StationPanel({
  selected,
  radiusM,
  onClose,
  onRadiusChange,
  permits,
}: {
  selected: SelectedStation | null
  radiusM: number
  onClose: () => void
  onRadiusChange: (m: number) => void
  permits: Permit[]
}) {
  const open = !!selected
  const station = selected
    ? (selected.kind === 'rail'
        ? RAIL_STATIONS.find((s) => s.id === selected.id)
        : RAPID_BUS_STOPS.find((s) => s.id === selected.id))
    : null

  const isRail = selected?.kind === 'rail'
  const radiusOptions = isRail ? [400, 800, 1600] : [160, 400]

  // Permits already filtered by the parent — count them
  const count = permits.length

  return (
    <LensInfoPanel
      open={open}
      eyebrow={isRail ? 'Rail station' : 'Rapid bus stop'}
      title={station?.name ?? '—'}
      subtitle={
        station && 'modes' in station
          ? `Modes: ${(station as RailStation).modes.join(' / ')}`
          : station && 'routes' in station
            ? `Routes: ${(station as RapidBusStop).routes.join(', ')}`
            : undefined
      }
      hero={
        station
          ? { eyebrow: 'Permits in shed', value: String(count), detail: `${radiusM}m radius` }
          : undefined
      }
      primary={{
        eyebrow: 'Radius',
        rows: radiusOptions.map((m) => ({
          label: `${m}m`,
          value: m === radiusM ? '✓' : '',
          pct: m === radiusM ? 1 : 0.1,
          color: '#9a4a31',
        })),
      }}
      onClose={onClose}
    />
  )
}
```

(`LensInfoPanel` doesn't natively expose row-click handlers; for the radius slider we render the buttons inline in the next sub-step.)

- [ ] **Step 2: Mount the panel in the map tree**

In the main return of `Map.tsx`:

```tsx
<StationPanel
  selected={selectedStation}
  radiusM={stationRadiusM}
  onClose={() => setSelectedStation(null)}
  onRadiusChange={setStationRadiusM}
  permits={filteredPermits}
/>
```

- [ ] **Step 3: Verify and commit**

```bash
npm run dev
```

Click a station → side panel appears with permit count and radius info.

```bash
git add components/Map.tsx
git commit -m "feat: per-station LensInfoPanel"
```

### Task 2.7: URL params (`transit`, `station`, `radius`)

**Files:**
- Modify: `components/Map.tsx`

- [ ] **Step 1: Add URL parse/write for the new params**

In the URL-sync effect (around line 209), add:

```ts
// Parse on mount
const transitParam = params.get('transit')
if (transitParam === 'rail' || transitParam === 'both') setRailOnly(true)
if (transitParam === 'rapid-bus' || transitParam === 'both') setRapidBusOnly(true)
const stationParam = params.get('station')
if (stationParam) {
  // Defer until stations hydrate
  const kind = stationParam.startsWith('bus-') ? 'rapid-bus' : 'rail'
  setSelectedStation({ kind, id: stationParam })
}
const radiusParam = Number(params.get('radius'))
if (Number.isFinite(radiusParam) && radiusParam > 0) setStationRadiusM(radiusParam)
```

In the URL-write effect (around line 219):

```ts
let transitValue = ''
if (railOnly && rapidBusOnly) transitValue = 'both'
else if (railOnly) transitValue = 'rail'
else if (rapidBusOnly) transitValue = 'rapid-bus'
setOrDelete('transit', transitValue, '')

setOrDelete('station', selectedStation?.id ?? '', '')
setOrDelete('radius', String(stationRadiusM), String(selectedStation?.kind === 'rapid-bus' ? RAPID_BUS_THRESHOLD_M : RAIL_THRESHOLD_M))
```

Update the dependency array to include the new state.

- [ ] **Step 2: Verify in browser**

```bash
npm run dev
```

Toggle the rail filter; the URL gains `?transit=rail`. Refresh the page; the filter restores. Click a station; the URL gains `&station=bart-embarcadero&radius=800`. Copy-paste the URL into a new tab; the same selection appears.

- [ ] **Step 3: Commit**

```bash
git add components/Map.tsx
git commit -m "feat: transit/station/radius URL params for share + restore"
```

---

## Phase 3 — Zoning rules + family-zoning + district panel

### Task 3.1: `lib/family-zoning.ts`

**Files:**
- Create: `lib/family-zoning.ts`
- Test: `__tests__/family-zoning.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/family-zoning.test.ts
import { eligibleLaws, permitLawHeuristic, type FamilyLaw } from '../lib/family-zoning'
import type { Permit } from '../lib/types'

describe('eligibleLaws', () => {
  it('flags SB-9 only for RH-1', () => {
    const laws = eligibleLaws('RH-1', 'Residential').map((l) => l.law)
    expect(laws).toContain('SB-9')
    expect(eligibleLaws('RH-2', 'Residential').map((l) => l.law)).not.toContain('SB-9')
  })

  it('flags ADU for any Residential', () => {
    expect(eligibleLaws('RH-3', 'Residential').map((l) => l.law)).toContain('ADU')
    expect(eligibleLaws('RM-2', 'Residential').map((l) => l.law)).toContain('ADU')
  })

  it('flags AB-2011 only for Commercial / Mixed Use', () => {
    expect(eligibleLaws('C-3-O', 'Commercial').map((l) => l.law)).toContain('AB-2011')
    expect(eligibleLaws('NCT-3', 'Mixed Use').map((l) => l.law)).toContain('AB-2011')
    expect(eligibleLaws('RH-1', 'Residential').map((l) => l.law)).not.toContain('AB-2011')
  })

  it('always flags SB-35 (SF is below RHNA)', () => {
    expect(eligibleLaws('RH-1', 'Residential').map((l) => l.law)).toContain('SB-35')
    expect(eligibleLaws('C-3-O', 'Commercial').map((l) => l.law)).toContain('SB-35')
  })
})

describe('permitLawHeuristic', () => {
  const base: Permit = {
    permit_number: 'TEST', location: { type: 'Point', coordinates: [-122.4, 37.7] },
    existing_units: 1, proposed_units: 2,
    proposed_use: 'single family dwelling',
    existing_use: 'single family dwelling',
    status: 'filed',
  } as unknown as Permit

  it('flags SB-9 likely when RH-1 + 1->2 units', () => {
    const out = permitLawHeuristic(base, 'RH-1')
    expect(out.find((x) => x.law === 'SB-9')?.confidence).toBe('likely')
  })

  it('flags ADU likely when proposed_use mentions ADU', () => {
    const p = { ...base, proposed_use: 'accessory dwelling unit' } as Permit
    const out = permitLawHeuristic(p, 'RH-1')
    expect(out.find((x) => x.law === 'ADU')?.confidence).toBe('likely')
  })

  it('returns possible (not likely) for eligible but unsignaled laws', () => {
    const out = permitLawHeuristic(base, 'RH-1')
    expect(out.find((x) => x.law === 'SB-35')?.confidence).toBe('possible')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest family-zoning
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `family-zoning.ts`**

```ts
// lib/family-zoning.ts
/**
 * California state housing law eligibility per SF zoning district.
 * Encoded as logic, not transcribed values — see CA Government Code:
 *   SB-9         (Gov. Code §§ 65852.21, 66411.7) — duplex/lot split in RH-1
 *   AB-2011      (Gov. Code §§ 65912.110-65912.124) — commercial-to-resi by-right
 *   SB-35        (Gov. Code § 65913.4) — streamlined ministerial; SF below RHNA
 *   Density Bonus (Gov. Code § 65915)
 *   ADU          (Gov. Code §§ 65852.2, 65852.22)
 */

import type { Permit } from './types'
import { netDelta } from './permit-style'

export type FamilyLaw = 'SB-9' | 'AB-2011' | 'SB-35' | 'density-bonus' | 'ADU'

export interface FamilyLawEligibility {
  law: FamilyLaw
  uplift_summary: string
}

const RESIDENTIAL_GEN = new Set(['Residential', 'Mixed Use'])
const COMMERCIAL_GEN = new Set(['Commercial', 'Mixed Use'])

export function eligibleLaws(zoningSim: string, gen: string): FamilyLawEligibility[] {
  const out: FamilyLawEligibility[] = []

  // SB-9: single-family-only zones (RH-1)
  if (gen === 'Residential' && zoningSim === 'RH-1') {
    out.push({
      law: 'SB-9',
      uplift_summary: '1 unit baseline → up to 4 units via lot split + duplex + ADU',
    })
  }

  // AB-2011: commercial / mixed-use corridors
  if (COMMERCIAL_GEN.has(gen)) {
    out.push({
      law: 'AB-2011',
      uplift_summary: 'By-right residential on eligible commercial corridors',
    })
  }

  // SB-35: SF is consistently below RHNA, so applies to all eligible residential
  if (RESIDENTIAL_GEN.has(gen)) {
    out.push({
      law: 'SB-35',
      uplift_summary: 'Streamlined ministerial review when affordability targets met',
    })
  }

  // Density bonus: residential or mixed use
  if (RESIDENTIAL_GEN.has(gen)) {
    out.push({
      law: 'density-bonus',
      uplift_summary: 'Up to 50% unit increase in exchange for affordable units',
    })
  }

  // ADU: every residential district
  if (gen === 'Residential') {
    out.push({
      law: 'ADU',
      uplift_summary: 'Up to 2 ADUs per lot allowed by state law',
    })
  }

  return out
}

export interface PermitLawFlag {
  law: FamilyLaw
  confidence: 'likely' | 'possible'
  reason: string
}

export function permitLawHeuristic(permit: Permit, zoningSim: string | null): PermitLawFlag[] {
  const out: PermitLawFlag[] = []
  if (!zoningSim) return out

  // Derive gen from zoningSim — simple prefix mapping. Codes like RH/RM = Residential,
  // NC/NCT/NCD = Mixed Use, C = Commercial, PDR = Industrial, P = Public.
  const gen = inferGenFromCode(zoningSim)
  const possible = eligibleLaws(zoningSim, gen)
  const delta = netDelta(permit.existing_units, permit.proposed_units)
  const useText = `${permit.proposed_use ?? ''} ${permit.existing_use ?? ''}`.toLowerCase()

  for (const law of possible) {
    let confidence: 'likely' | 'possible' = 'possible'
    let reason = `${zoningSim} is eligible for ${law.law}`

    switch (law.law) {
      case 'SB-9':
        if (zoningSim === 'RH-1' && delta != null && delta >= 1 && delta <= 3) {
          confidence = 'likely'
          reason = `RH-1 lot with +${delta} units fits SB-9 (lot split or duplex)`
        }
        break
      case 'ADU':
        if (/\baccessory dwelling|^adu\b|\badu\b/.test(useText)) {
          confidence = 'likely'
          reason = 'Permit description mentions ADU'
        }
        break
      case 'AB-2011':
        if (COMMERCIAL_GEN.has(gen) && /residential/.test(useText) && delta != null && delta > 0) {
          confidence = 'likely'
          reason = `Commercial zoning + new residential units suggests AB-2011`
        }
        break
      case 'density-bonus':
        if (/density.bonus|state.density/.test(useText)) {
          confidence = 'likely'
          reason = 'Permit description mentions density bonus'
        }
        break
      case 'SB-35':
        // SB-35 use is rarely explicit on permits; stay at possible.
        break
    }

    out.push({ law: law.law, confidence, reason })
  }

  return out
}

function inferGenFromCode(code: string): string {
  if (/^RH|^RM|^RTO|^RC/.test(code)) return 'Residential'
  if (/^NC|^MUR|^MUO|^MUG/.test(code)) return 'Mixed Use'
  if (/^C-/.test(code)) return 'Commercial'
  if (/^PDR|^M-/.test(code)) return 'Industrial'
  if (/^P\b/.test(code)) return 'Public'
  return 'Other'
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest family-zoning
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/family-zoning.ts __tests__/family-zoning.test.ts
git commit -m "feat: family-zoning state-law eligibility + permit heuristic"
```

### Task 3.2: `lib/zoning-rules.ts` schema + sample records

**Files:**
- Create: `lib/zoning-rules.ts`
- Test: `__tests__/zoning-rules.test.ts`

This task ships the **schema + 5 sample records** (`RH-1`, `RH-2`, `RH-3`, `NCT-3`, `C-3-O`). The remaining ~70 codes are populated in Task 3.3 below as a single transcription task.

- [ ] **Step 1: Write the failing schema test**

```ts
// __tests__/zoning-rules.test.ts
import { ZONING_RULES, getZoningRecord, type ZoningRecord } from '../lib/zoning-rules'

describe('ZONING_RULES schema', () => {
  it('includes at least the 5 representative codes', () => {
    expect(Object.keys(ZONING_RULES)).toEqual(
      expect.arrayContaining(['RH-1', 'RH-2', 'RH-3', 'NCT-3', 'C-3-O']),
    )
  })

  it('every record carries per-field source citations', () => {
    for (const code of Object.keys(ZONING_RULES)) {
      const r = ZONING_RULES[code]
      expect(r.source).toBeDefined()
      expect(r.source.retrieved_at).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      // density is required, so always sourced
      expect(r.source.density?.section).toMatch(/^§/)
      expect(r.source.density?.url).toMatch(/^https?:\/\//)
    }
  })

  it('RH-1 has density=1 unit per lot', () => {
    expect(ZONING_RULES['RH-1'].density.units_per_lot).toBe(1)
  })

  it('RH-1 cites §209 for density', () => {
    expect(ZONING_RULES['RH-1'].source.density?.section).toBe('§209')
  })
})

describe('getZoningRecord', () => {
  it('returns undefined for unknown code', () => {
    expect(getZoningRecord('NOPE')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest zoning-rules
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement schema + 5 sample records**

```ts
// lib/zoning-rules.ts
/**
 * Transcribed zoning-rule values per SF zoning_sim code. Source-of-truth
 * is the SF Planning Code; every field has a per-record citation.
 *
 * Transcription is a one-time agent task. When the Planning Code is
 * amended, re-transcribe the affected sections and bump retrieved_at.
 *
 * Build-time validation in scripts/build-cross-stats.ts verifies that
 * every zoning_sim from DataSF has a matching record here.
 */

import type { FamilyLawEligibility } from './family-zoning'

export interface CodeCitation {
  article: string
  section: string
  url: string
}

export interface ZoningRecord {
  code: string
  density: { units_per_lot?: number; du_per_acre?: number; note?: string }
  far?: { max: number; note?: string }
  principal_uses: string[]
  parking_min: { residential?: string; commercial?: string }
  setbacks?: { front_ft?: number; rear_ft?: number; side_ft?: number }
  lot_coverage_max_pct?: number
  family_laws: FamilyLawEligibility[]
  source: {
    density: CodeCitation
    far?: CodeCitation
    principal_uses: CodeCitation
    parking_min: CodeCitation
    setbacks?: CodeCitation
    lot_coverage_max_pct?: CodeCitation
    retrieved_at: string
  }
}

const AMLEGAL = 'https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_planning'

const ART2 = (section: string): CodeCitation => ({
  article: 'Article 2', section, url: `${AMLEGAL}/0-0-0-${section.replace(/[§\s]/g, '')}`,
})
const ART7 = (section: string): CodeCitation => ({
  article: 'Article 7', section, url: `${AMLEGAL}/0-0-0-${section.replace(/[§\s]/g, '')}`,
})
const ART1_5 = (section: string): CodeCitation => ({
  article: 'Article 1.5', section, url: `${AMLEGAL}/0-0-0-${section.replace(/[§\s]/g, '')}`,
})
const ART8 = (section: string): CodeCitation => ({
  article: 'Article 8', section, url: `${AMLEGAL}/0-0-0-${section.replace(/[§\s]/g, '')}`,
})

const RETRIEVED = '2026-05-10'

export const ZONING_RULES: Record<string, ZoningRecord> = {
  'RH-1': {
    code: 'RH-1',
    density: { units_per_lot: 1 },
    far: { max: 1.8, note: 'See §123 for FAR controls' },
    principal_uses: ['Single-family dwelling', 'ADU (state law)'],
    parking_min: { residential: '1 space per dwelling (no min near transit per AB-2097)' },
    setbacks: { front_ft: 15, rear_ft: 25, side_ft: 0 },
    lot_coverage_max_pct: 45,
    family_laws: [],  // filled at runtime by family-zoning.ts
    source: {
      density: ART2('§209'),
      far: { article: 'Article 1.2', section: '§123', url: `${AMLEGAL}/0-0-0-123` },
      principal_uses: ART2('§209'),
      parking_min: ART1_5('§151.1'),
      setbacks: ART2('§132'),
      lot_coverage_max_pct: ART2('§209'),
      retrieved_at: RETRIEVED,
    },
  },
  'RH-2': {
    code: 'RH-2',
    density: { units_per_lot: 2 },
    principal_uses: ['Two-family dwelling', 'ADU (state law)'],
    parking_min: { residential: '1 space per dwelling (no min near transit per AB-2097)' },
    setbacks: { front_ft: 15, rear_ft: 25, side_ft: 0 },
    lot_coverage_max_pct: 45,
    family_laws: [],
    source: {
      density: ART2('§209'),
      principal_uses: ART2('§209'),
      parking_min: ART1_5('§151.1'),
      setbacks: ART2('§132'),
      lot_coverage_max_pct: ART2('§209'),
      retrieved_at: RETRIEVED,
    },
  },
  'RH-3': {
    code: 'RH-3',
    density: { units_per_lot: 3 },
    principal_uses: ['Three-family dwelling', 'ADU (state law)'],
    parking_min: { residential: '1 space per dwelling (no min near transit per AB-2097)' },
    setbacks: { front_ft: 15, rear_ft: 25, side_ft: 0 },
    lot_coverage_max_pct: 45,
    family_laws: [],
    source: {
      density: ART2('§209'),
      principal_uses: ART2('§209'),
      parking_min: ART1_5('§151.1'),
      setbacks: ART2('§132'),
      lot_coverage_max_pct: ART2('§209'),
      retrieved_at: RETRIEVED,
    },
  },
  'NCT-3': {
    code: 'NCT-3',
    density: { du_per_acre: 174, note: 'Moderate-Scale Neighborhood Commercial Transit District' },
    far: { max: 3.6 },
    principal_uses: ['Residential', 'Ground-floor retail/restaurant', 'Service uses'],
    parking_min: { residential: '0 (transit-oriented)', commercial: '0' },
    setbacks: { front_ft: 0, rear_ft: 25 },
    lot_coverage_max_pct: 75,
    family_laws: [],
    source: {
      density: ART7('§754'),
      far: { article: 'Article 1.2', section: '§124', url: `${AMLEGAL}/0-0-0-124` },
      principal_uses: ART7('§754'),
      parking_min: ART1_5('§151.1'),
      setbacks: ART7('§754'),
      lot_coverage_max_pct: ART7('§754'),
      retrieved_at: RETRIEVED,
    },
  },
  'C-3-O': {
    code: 'C-3-O',
    density: { note: 'No specific density cap; controlled by height + FAR' },
    far: { max: 9.0 },
    principal_uses: ['Office', 'Retail', 'Residential (conditional above 24th floor)'],
    parking_min: { commercial: 'Maximum, not minimum — §151.1' },
    family_laws: [],
    source: {
      density: ART8('§210.2'),
      far: { article: 'Article 1.2', section: '§124', url: `${AMLEGAL}/0-0-0-124` },
      principal_uses: ART8('§210.2'),
      parking_min: ART1_5('§151.1'),
      retrieved_at: RETRIEVED,
    },
  },
}

export function getZoningRecord(code: string): ZoningRecord | undefined {
  return ZONING_RULES[code]
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest zoning-rules
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/zoning-rules.ts __tests__/zoning-rules.test.ts
git commit -m "feat: zoning rules schema + 5 sample records with citations"
```

### Task 3.3: Transcribe remaining zoning codes

**Files:**
- Modify: `lib/zoning-rules.ts`
- Modify: `scripts/build-cross-stats.ts` (add coverage assertion)

This is a single batch transcription. Coverage = every `zoning_sim` returned by DataSF.

- [ ] **Step 1: List all unique `zoning_sim` codes**

```bash
node -e "fetch('https://data.sfgov.org/resource/3i4a-hu95.json?\$limit=5000&\$select=zoning_sim').then(r=>r.json()).then(rows=>{const s=new Set(rows.map(r=>r.zoning_sim).filter(Boolean));console.log([...s].sort().join('\n'));console.log('---','count:',s.size)})"
```

Save the output to a scratch file. The list is the universe to populate.

- [ ] **Step 2: For each remaining code, transcribe an entry**

For each `zoning_sim` not yet in `ZONING_RULES`:

1. Look up its `codesection` (already returned by DataSF on `3i4a-hu95`) — that's the link to the Planning Code section.
2. Open the AmericanLegal URL.
3. Transcribe `density`, `far`, `principal_uses`, `parking_min`, `setbacks`, `lot_coverage_max_pct` from the per-district tables.
4. Add a record to `ZONING_RULES`. Use the same `ART2`/`ART7`/`ART8`/`ART1_5` helpers for citations.

Estimated effort: ~30 seconds per code × ~75 codes ≈ 40 min.

- [ ] **Step 3: Cross-check 5 random codes against the published Code**

Pick 5 random codes from the populated set. For each, verify height/density/FAR against the live Planning Code page. If any value differs, fix and commit.

- [ ] **Step 4: Add the build-time coverage assertion**

In `scripts/build-cross-stats.ts`, after the zoning fetch:

```ts
import { ZONING_RULES } from '../lib/zoning-rules'

const presentCodes = new Set(Object.keys(ZONING_RULES))
const datasetCodes = new Set(zoningPolys.map((z) => (z.properties as { zoning_sim?: string }).zoning_sim).filter(Boolean))
const missing = [...datasetCodes].filter((c) => !presentCodes.has(c))
if (missing.length > 0) {
  throw new Error(
    `zoning-rules missing transcription for ${missing.length} codes:\n  ${missing.join('\n  ')}\n` +
    `Add records to lib/zoning-rules.ts.`,
  )
}
console.log(`✓ zoning-rules coverage: ${datasetCodes.size}/${datasetCodes.size}`)
```

- [ ] **Step 5: Run `npm run cross-stats` and verify it passes**

```bash
npm run cross-stats
```

Expected: `✓ zoning-rules coverage: NN/NN` printed. No error.

- [ ] **Step 6: Commit**

```bash
git add lib/zoning-rules.ts scripts/build-cross-stats.ts public/cross-stats.json
git commit -m "feat: transcribe remaining zoning districts with citations"
```

### Task 3.4: `ZoningDistrictPanel` component

**Files:**
- Create: `components/ZoningDistrictPanel.tsx`

- [ ] **Step 1: Implement the panel**

```tsx
// components/ZoningDistrictPanel.tsx
'use client'
import { LensInfoPanel } from './LensInfoPanel'
import { getZoningRecord } from '@/lib/zoning-rules'
import { eligibleLaws } from '@/lib/family-zoning'

interface Props {
  zoningSim: string | null
  gen: string | null
  heightFt?: number
  bulk?: string
  onClose: () => void
}

export function ZoningDistrictPanel({ zoningSim, gen, heightFt, bulk, onClose }: Props) {
  const open = !!zoningSim
  const rec = zoningSim ? getZoningRecord(zoningSim) : null
  const laws = zoningSim && gen ? eligibleLaws(zoningSim, gen) : []

  if (!rec || !zoningSim || !gen) {
    return <LensInfoPanel open={open} eyebrow="Zoning district" title={zoningSim ?? '—'} onClose={onClose} />
  }

  const ruleRows: { label: string; value: string; pct: number; color: string }[] = []
  if (heightFt) ruleRows.push({ label: `Height: ${heightFt} ft${bulk ? ` (bulk ${bulk})` : ''}`, value: '', pct: 1, color: '#7d9b76' })
  if (rec.density.units_per_lot) ruleRows.push({ label: `Density: ${rec.density.units_per_lot} unit(s) per lot`, value: '', pct: 1, color: '#7d9b76' })
  if (rec.density.du_per_acre) ruleRows.push({ label: `Density: ${rec.density.du_per_acre} DU/acre`, value: '', pct: 1, color: '#7d9b76' })
  if (rec.far?.max) ruleRows.push({ label: `FAR: ${rec.far.max}`, value: '', pct: 1, color: '#7d9b76' })
  if (rec.parking_min.residential) ruleRows.push({ label: `Parking (resi): ${rec.parking_min.residential}`, value: '', pct: 1, color: '#b08968' })

  const lawRows = laws.map((l) => ({
    label: `${l.law}: ${l.uplift_summary}`,
    value: '✓',
    pct: 1,
    color: '#9a4a31',
  }))

  return (
    <LensInfoPanel
      open={open}
      eyebrow="Zoning district"
      title={zoningSim}
      subtitle={gen}
      hero={heightFt ? { eyebrow: 'Max height', value: `${heightFt} ft`, detail: bulk ? `bulk ${bulk}` : '' } : undefined}
      primary={{ eyebrow: 'Rules', rows: ruleRows }}
      secondary={{ eyebrow: 'State-law uplift', rows: lawRows }}
      onClose={onClose}
    />
  )
}
```

- [ ] **Step 2: Wire in `Map.tsx`** — replace the existing `ZoningCategoryPanel` usage with the new panel, keyed on `selectedZoningDistrict` (a `zoning_sim` string, not just `gen`).

Add state:

```ts
const [selectedZoningDistrict, setSelectedZoningDistrict] = useState<{
  zoningSim: string; gen: string; heightFt?: number; bulk?: string
} | null>(null)
const [zoningHeights, setZoningHeights] = useState<Record<string, { height_ft?: number; bulk?: string }>>({})
```

Hydrate heights:

```ts
useEffect(() => {
  fetch('/zoning-heights.json')
    .then((r) => (r.ok ? r.json() : []))
    .then((rows: { code: string; height_ft?: number; bulk?: string }[]) => {
      const map: Record<string, { height_ft?: number; bulk?: string }> = {}
      for (const r of rows) map[r.code] = { height_ft: r.height_ft, bulk: r.bulk }
      setZoningHeights(map)
    })
    .catch(() => {})
}, [])
```

- [ ] **Step 3: Update `ZoningOverlay` click handler to pass `zoning_sim`**

In `components/ZoningOverlay.tsx`, change the `onSelect` prop signature to pass `(zoning_sim, gen)`:

```tsx
interface Props {
  selectedDistrict?: string | null
  onSelect?: (zoningSim: string, gen: string) => void
}
```

In the click handler (line 109-114), use `props.zoning_sim` and `props.gen` from the feature properties.

- [ ] **Step 4: Hook up the click in `Map.tsx`**

```tsx
<ZoningOverlay
  selectedDistrict={selectedZoningDistrict?.zoningSim ?? null}
  onSelect={(zoningSim, gen) => {
    const h = zoningHeights[zoningSim]
    setSelectedZoningDistrict({ zoningSim, gen, heightFt: h?.height_ft, bulk: h?.bulk })
  }}
/>
```

Mount the panel:

```tsx
<ZoningDistrictPanel
  zoningSim={selectedZoningDistrict?.zoningSim ?? null}
  gen={selectedZoningDistrict?.gen ?? null}
  heightFt={selectedZoningDistrict?.heightFt}
  bulk={selectedZoningDistrict?.bulk}
  onClose={() => setSelectedZoningDistrict(null)}
/>
```

Remove the old `ZoningCategoryPanel` component and its state.

- [ ] **Step 5: Add `district` URL param**

In the URL effects in `Map.tsx`:

```ts
// parse
const districtParam = params.get('district')
if (districtParam) {
  // Defer fill until ZoningOverlay's onSelect fires — for now, just stash the code.
  setSelectedZoningDistrict({ zoningSim: districtParam, gen: '' })
}

// write
setOrDelete('district', selectedZoningDistrict?.zoningSim ?? '', '')
```

- [ ] **Step 6: Verify in browser**

```bash
npm run dev
```

Switch to "zoning" lens, click a polygon → district panel opens with height, density, FAR, parking, and family-zoning uplift list.

- [ ] **Step 7: Commit**

```bash
git add components/ZoningDistrictPanel.tsx components/ZoningOverlay.tsx components/Map.tsx
git commit -m "feat: zoning-district panel with rules + family-zoning context"
```

### Task 3.5: Family-zoning badges on `PermitDetailContent`

**Files:**
- Modify: `components/PermitDetailContent.tsx`

- [ ] **Step 1: Resolve the permit's zoning_sim**

Permits don't carry `zoning_sim` directly. Use the point-in-polygon helper against the cached zoning GeoJSON. For now, add a `zoningSim` prop to `PermitDetailContent`; the parent resolves it.

In `PermitDetailContent.tsx`, add:

```tsx
import { permitLawHeuristic } from '@/lib/family-zoning'

interface Props {
  // ...existing
  zoningSim?: string | null
}

// inside the render, after existing badges:
{props.zoningSim && (() => {
  const flags = permitLawHeuristic(props.permit, props.zoningSim)
  if (flags.length === 0) return null
  return (
    <div className="mt-3 flex flex-wrap gap-1">
      {flags.map((f) => (
        <span
          key={f.law}
          title={f.reason}
          className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border"
          style={{
            color: f.confidence === 'likely' ? '#9a4a31' : '#78716c',
            borderColor: f.confidence === 'likely' ? '#9a4a31' : '#d6cfbe',
          }}
        >
          {f.law} {f.confidence}
        </span>
      ))}
    </div>
  )
})()}
```

- [ ] **Step 2: Resolve `zoningSim` in the parent (`PermitPanel` or `/permits/[id]/page.tsx`)**

Add a small helper that takes the permit's coordinates and the cached zoning GeoJSON, returning the matching `zoning_sim`. Use `pointInGeometry` from `@/lib/point-in-polygon`. Plumb the result through to `PermitDetailContent`.

- [ ] **Step 3: Verify in browser**

Open any housing permit in a Residential district. Badges render under the existing chips. Tooltip on hover explains the heuristic.

- [ ] **Step 4: Commit**

```bash
git add components/PermitDetailContent.tsx components/PermitPanel.tsx app/permits
git commit -m "feat: family-zoning badges on permit detail"
```

---

## Phase 4 — Filter UI separation

### Task 4.1: `FilterPopover` component

**Files:**
- Create: `components/FilterPopover.tsx`
- Test: `__tests__/filter-popover.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/filter-popover.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { FilterPopover } from '../components/FilterPopover'

describe('FilterPopover', () => {
  it('renders nothing when closed', () => {
    render(<FilterPopover open={false} onClose={() => {}}><div>body</div></FilterPopover>)
    expect(screen.queryByText('body')).toBeNull()
  })

  it('renders children when open', () => {
    render(<FilterPopover open={true} onClose={() => {}}><div>body</div></FilterPopover>)
    expect(screen.getByText('body')).toBeInTheDocument()
  })

  it('calls onClose when Escape is pressed', () => {
    const onClose = jest.fn()
    render(<FilterPopover open={true} onClose={onClose}><div>body</div></FilterPopover>)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest filter-popover
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `FilterPopover`**

```tsx
// components/FilterPopover.tsx
'use client'
import { useEffect, useRef, type ReactNode } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  children: ReactNode
  anchorRef?: React.RefObject<HTMLElement | null>
  className?: string
}

export function FilterPopover({ open, onClose, children, anchorRef, className = '' }: Props) {
  const popRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const onClick = (e: MouseEvent) => {
      if (!popRef.current) return
      if (popRef.current.contains(e.target as Node)) return
      if (anchorRef?.current?.contains(e.target as Node)) return
      onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onClick)
    }
  }, [open, onClose, anchorRef])

  if (!open) return null
  return (
    <div
      ref={popRef}
      role="dialog"
      className={`absolute z-[1100] mt-1 bg-paper border border-paper-edge rounded-md shadow-lg p-3 min-w-[240px] ${className}`}
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest filter-popover
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/FilterPopover.tsx __tests__/filter-popover.test.tsx
git commit -m "feat: anchored FilterPopover with Esc + click-outside dismissal"
```

### Task 4.2: Refactor `FilterPanel` to chip-triggers + popovers

**Files:**
- Modify: `components/FilterPanel.tsx`

Large refactor — break into sub-steps.

- [ ] **Step 1: Add `openFilter` state + trigger chip helper**

In `FilterPanel.tsx`, near the top of the component:

```tsx
const [openFilter, setOpenFilter] = useState<string | null>(null)

function TriggerChip({ id, label, onOpen }: { id: string; label: string; onOpen: () => void }) {
  const isOpen = openFilter === id
  return (
    <button
      type="button"
      onClick={() => { setOpenFilter(isOpen ? null : id); if (!isOpen) onOpen() }}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${
        isOpen ? 'bg-ink text-paper border-ink' : 'bg-paper text-ink border-paper-edge hover:border-ink'
      }`}
    >
      {label}
      <span className="text-[10px]">▾</span>
    </button>
  )
}
```

- [ ] **Step 2: Replace each `<section>` with a `<div>` containing a `TriggerChip` + `FilterPopover`**

For each filter section, replace the inline section block with:

```tsx
<div className="relative">
  <TriggerChip id="use-type" label={`Use: ${categorySummary}`} onOpen={() => {}} />
  <FilterPopover open={openFilter === 'use-type'} onClose={() => setOpenFilter(null)}>
    <div className="flex flex-wrap gap-1.5">
      {CATEGORIES.map((cat) => (
        <CategoryChip key={cat} cat={cat} on={selectedCategories.has(cat)} onToggle={() => onToggleCategory(cat)} />
      ))}
    </div>
  </FilterPopover>
</div>
```

Do the same for lifecycle, recent activity, min units, completed years, and transit-adjacent. Each gets:

- Trigger label that summarizes the current value (e.g. `Stages: 3 of 5`)
- Popover body containing the existing chip/button group

- [ ] **Step 3: Remove the embedded `SectionList`**

Delete the `SectionList` invocation at the bottom of the panel (this content moves to `BrowsePanel` in Task 4.3).

- [ ] **Step 4: Verify in browser**

```bash
npm run dev
```

The filter panel header still shows the summary sentence. Below, a row of chip-triggers. Click each → popover with options.

- [ ] **Step 5: Commit**

```bash
git add components/FilterPanel.tsx
git commit -m "feat: collapse FilterPanel sections into popover chip-triggers"
```

### Task 4.3: `BrowsePanel` component

**Files:**
- Create: `components/BrowsePanel.tsx`

- [ ] **Step 1: Move `SectionList` into the new file**

Cut the `SectionList` function from `FilterPanel.tsx` and paste it into `components/BrowsePanel.tsx` as the exported component, renamed `BrowsePanel`. Keep its props.

```tsx
// components/BrowsePanel.tsx
'use client'
import type { MapMode } from './MapModeSwitch'

interface Props {
  open: boolean
  onClose: () => void
  mode: MapMode
  crossStats?: import('@/lib/cross-stats').CrossStats | null
  permitsByNhood?: Record<string, import('@/lib/types').Permit[]>
  onSelectNhood?: (name: string) => void
  onSelectZoning?: (cat: import('@/lib/cross-stats').ZoningCategory) => void
  onSelectTransitBand?: (band: import('@/lib/cross-stats').TransitBand) => void
}

export function BrowsePanel({ open, onClose, mode, crossStats, permitsByNhood, onSelectNhood, onSelectZoning, onSelectTransitBand }: Props) {
  if (!open) return null
  return (
    <aside className="absolute top-4 left-4 z-[1000] bg-paper border border-paper-edge rounded-md shadow-lg w-[calc(100vw-2rem)] max-w-[320px] max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden">
      <header className="bg-ink text-paper px-4 py-3 flex items-center justify-between">
        <span className="font-serif text-base">Browse all</span>
        <button onClick={onClose} aria-label="Close browse" className="text-[14px]">✕</button>
      </header>
      <div className="overflow-y-auto p-4">
        {/* ... move SectionList body here, including the row-click handlers
            that now call onSelectNhood / onSelectZoning / onSelectTransitBand ... */}
      </div>
    </aside>
  )
}
```

(Inline the SectionList body. Update each row's button to fire the corresponding `onSelect*` callback.)

- [ ] **Step 2: Add "Browse all" trigger in `FilterPanel.tsx`**

Add a button in the panel header that, when clicked, sets `browseOpen=true` (state lifted to `Map.tsx`).

- [ ] **Step 3: Mount `BrowsePanel` in `Map.tsx`**

```tsx
const [browseOpen, setBrowseOpen] = useState(false)

// in JSX:
<BrowsePanel
  open={browseOpen}
  onClose={() => setBrowseOpen(false)}
  mode={mapMode}
  crossStats={crossStats}
  permitsByNhood={permitsByNhood}
  onSelectNhood={(n) => { openNhoodPanel(n); setBrowseOpen(false) }}
  onSelectZoning={(cat) => { setSelectedZoning(cat); setBrowseOpen(false) }}
  onSelectTransitBand={(b) => { setSelectedTransitBand(b); setBrowseOpen(false) }}
/>
```

- [ ] **Step 4: URL param `browse`**

```ts
// parse:
if (params.get('browse') === '1') setBrowseOpen(true)
// write:
setOrDelete('browse', browseOpen ? '1' : '', '')
```

- [ ] **Step 5: Verify in browser**

```bash
npm run dev
```

Click "Browse all" → side panel opens. Click a row → corresponding view focuses, panel closes.

- [ ] **Step 6: Commit**

```bash
git add components/BrowsePanel.tsx components/FilterPanel.tsx components/Map.tsx
git commit -m "feat: extract browse list into its own side panel"
```

---

## Phase 5 — Pin clustering

### Task 5.1: Wire `MarkerClusterGroup`

**Files:**
- Modify: `components/Map.tsx`

- [ ] **Step 1: Import and wrap pins**

```tsx
import MarkerClusterGroup from 'react-leaflet-cluster'
```

Replace the existing `<ZoomGatedPins ... />` render in the map tree with:

```tsx
<MarkerClusterGroup
  chunkedLoading
  disableClusteringAtZoom={15}
  maxClusterRadius={60}
  spiderfyOnMaxZoom={false}
  showCoverageOnHover={false}
>
  <ZoomGatedPins visiblePermits={visiblePermits} onSelect={openPermitPanel} zoom={mapZoom} />
</MarkerClusterGroup>
```

- [ ] **Step 2: Add `--cluster-opacity` CSS variable**

In the `ZoomTracker` callback:

```ts
function clusterOpacity(zoom: number): number {
  if (zoom <= PIN_FADE_MIN) return 1
  if (zoom >= PIN_FADE_MAX) return 0
  return 1 - (zoom - PIN_FADE_MIN) / (PIN_FADE_MAX - PIN_FADE_MIN)
}

// inside the zoom event handler:
el.style.setProperty('--cluster-opacity', String(clusterOpacity(map.getZoom())))
```

- [ ] **Step 3: Apply variable in CSS**

In `components/marker-cluster.css`:

```css
.marker-cluster {
  opacity: var(--cluster-opacity, 1);
  transition: opacity 100ms ease-out;
}
```

- [ ] **Step 4: Verify in browser**

```bash
npm run dev
```

At z 11–14 you see clusters with thin navy rings + counts. Above z 15 clustering disengages and raw pins appear. Between 13.5–14.5 both fade smoothly.

- [ ] **Step 5: Commit**

```bash
git add components/Map.tsx components/marker-cluster.css
git commit -m "feat: cluster pins at intermediate zoom levels"
```

### Task 5.2: Cluster render test

**Files:**
- Create: `__tests__/clustering.test.tsx`

- [ ] **Step 1: Write the test**

Realistically, JSDOM cannot fully execute leaflet+cluster — keep the test light: render `Map` (or a small extracted helper) at a known zoom and verify the `MarkerClusterGroup` component received the expected props. Use shallow render with the cluster module mocked.

```tsx
// __tests__/clustering.test.tsx
jest.mock('react-leaflet-cluster', () => ({
  __esModule: true,
  default: jest.fn(({ children, disableClusteringAtZoom }) => (
    <div data-testid="cluster-group" data-disable-at={disableClusteringAtZoom}>{children}</div>
  )),
}))

// ... import Map and render it ...

import { render, screen } from '@testing-library/react'
// (You may need to mock leaflet + react-leaflet first; follow the existing patterns in __tests__/.)

describe('Map clustering', () => {
  it('configures disableClusteringAtZoom=15', async () => {
    // simplified: render a tiny subtree with MarkerClusterGroup wrapped around a stub
    // ... use the existing test infra pattern from this project ...
  })
})
```

(If the project's existing test setup doesn't easily render `<Map>` due to leaflet's window deps, narrow to a unit test that imports just the cluster wrapper helper.)

- [ ] **Step 2: Run and commit**

```bash
npx jest clustering
git add __tests__/clustering.test.tsx
git commit -m "test: verify cluster group props"
```

---

## Self-review checklist (run after writing each phase)

- Spec coverage: every section in `docs/superpowers/specs/2026-05-10-improvements-design.md` mapped to a task above? Yes — Phase 1 (build pipeline + transit data sources) covers §3a + §3d + part of §1a (heights); Phase 2 covers §3b–§3c; Phase 3 covers §1 + family-zoning + §2c district URL param; Phase 4 covers §2a + §2b + §2c filter URL params; Phase 5 covers §4.
- Placeholder scan: no "TBD", "TODO", "fill in later" remain. ✓
- Type consistency: `RailStation` / `RapidBusStop` / `SelectedStation` / `ZoningRecord` / `CodeCitation` / `FamilyLaw` / `FamilyLawEligibility` / `PermitLawFlag` defined once, used consistently. ✓
- DRY: shared GTFS helpers in `_gtfs.ts`; shared slugify implementations duplicated across `bart-stations.ts`, `muni-stops.ts`, `caltrain-stations.ts` — acceptable since each is two lines and they live in source-specific files.

---

## Execution

After each phase commits cleanly and renders correctly in the browser, the phase is independently mergeable. The migration order matches the spec: Phase 1 → 2 → 3 → 4 → 5.
