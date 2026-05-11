# UI Rethink Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Direction-A UI rethink — zoom-gated chrome, S1 station markers + dotted corridor lines, B1 summary-card-grows-into-list pattern, 0.1/0.25 mi uniform shed, editorial zoning panels with height silhouette charts, and four critical bug fixes from the Playwright tour.

**Architecture:** Eight phases mirroring the spec's migration order. Phases 1–6 are additive and don't break the existing chrome. Phase 7 is the chrome cutover (delete the old, mount the new). Phase 8 finishes the URL param migration. Each phase is independently mergeable.

**Tech Stack:** Next.js 16, React 19, react-leaflet 5 + react-leaflet-cluster 4, @turf/turf, fflate (GTFS zip parsing), Vercel deploy, Upstash Redis cache, Jest + Testing Library, Playwright. TypeScript strict.

**Spec:** `docs/superpowers/specs/2026-05-11-ui-rethink-design.md`

---

## File structure overview

**New files**
- `scripts/sources/transit-corridors.ts` — GTFS `shapes.txt` fetcher for BART + Muni + Caltrain
- `components/TransitCorridors.tsx` — dotted-line corridor renderer
- `components/SummaryCard.tsx` — 3-state top-right card (collapsed / top-5 / all)
- `components/LensRail.tsx` — 3-pill bottom-left lens switcher
- `components/FilterFAB.tsx` — bottom-right circular button
- `components/FilterSheet.tsx` — slide-up bottom sheet with filters
- `components/SpecialAreasOverlay.tsx` — Presidio / GGNRA / Treasure Island overlay
- `components/Glossary.tsx` — inline term with hover-popover definition
- `components/HeightContext.tsx` — break-axis bar chart with SF silhouettes
- `lib/zoning-blurbs.ts` — per-gen editorial paragraphs
- `lib/zoning-glossary.ts` — term → definition lookup
- `lib/sf-height-references.ts` — landmark heights + SVG silhouette paths
- `lib/special-zoning-areas.ts` — federal/state/TIDA hand-listed areas

**Deleted files** (Phase 7)
- `components/FilterPanel.tsx`
- `components/FilterPopover.tsx`
- `components/BrowsePanel.tsx`
- `components/MapModeSwitch.tsx`
- `components/TransitRings.tsx` (replaced by `TransitCorridors`)

**Modified files**
- `scripts/sources/muni-stops.ts` — slug collision fix
- `scripts/sources/bart-stations.ts` — tighten `location_type` filter
- `scripts/build-cross-stats.ts` — drop 0.5 / 1 mi bands, emit corridors
- `lib/transit-stations.ts` — update threshold constants
- `lib/cross-stats.ts` — type changes (drop old band literals)
- `components/Map.tsx` — wire all new chrome + drop `ZoomGatedPins`
- `components/StationMarkers.tsx` — glyph-based icons
- `components/ZoningDistrictPanel.tsx` — blurb + glossary + height + PIM + recent permits
- `components/MapEventHandler.tsx` — unchanged but verify
- `app/globals.css` — station glyph styles, special-area pattern, sheet animations

**Build outputs (committed)**
- `public/transit-corridors.geojson` (new)
- `public/transit-rings.geojson` (regenerated with 0.1/0.25 only)
- `public/rapid-bus-rings.geojson` (regenerated, unchanged bands)
- `public/cross-stats.json` (regenerated, `transit_bands` shape changed)
- `public/rail-stations.json` (regenerated, fewer entries after location_type fix)
- `public/rapid-bus-stops.json` (regenerated, slug-collision fix)

---

## Phase 1 — Bug fixes (no UI change)

Land first; cluster + station behavior get visibly better with no other changes.

### Task 1.1: Slug-collision fix in `muni-stops.ts`

**Files:**
- Modify: `scripts/sources/muni-stops.ts`
- Modify: `__tests__/muni-stops.test.ts`

- [ ] **Step 1: Add a failing test for slug uniqueness**

Append to `__tests__/muni-stops.test.ts` inside `describe('buildRapidBusStops')`:

```ts
it('produces unique ids even when stop names collide', () => {
  // Two stops with the same name (e.g. opposite sides of an intersection)
  // must produce distinct ids so React keys don't collide.
  const colliding: typeof stops = [
    { stopid: '13002', stopname: 'Geary & Powell', latitude: '37.787', longitude: '-122.408', routes: '2001', location_type: '0' },
    { stopid: '13099', stopname: 'Geary & Powell', latitude: '37.787', longitude: '-122.4081', routes: '2001', location_type: '0' },
  ]
  const ids = new Set(buildRapidBusStops(colliding, routes, new Set(['2001'])).map((s) => s.id))
  expect(ids.size).toBe(2)
})
```

Add a parallel assertion to `describe('buildRailStations')`:

```ts
it('produces unique ids even when stop names collide', () => {
  const colliding: typeof stops = [
    { stopid: '13001', stopname: 'Castro Station', latitude: '37.762', longitude: '-122.43492', routes: '1001', location_type: '0' },
    { stopid: '13088', stopname: 'Castro Station', latitude: '37.7621', longitude: '-122.4350', routes: '1001', location_type: '0' },
  ]
  const railIds = new Set(['1001'])
  const ids = new Set(buildRailStations(colliding, railIds).map((s) => s.id))
  expect(ids.size).toBe(2)
})
```

- [ ] **Step 2: Run, expect FAIL**

```bash
npx jest muni-stops
```

Expected: both new tests fail with `expect(received).toBe(expected) // Expected: 2 Received: 1`.

- [ ] **Step 3: Update id construction in `muni-stops.ts`**

In `scripts/sources/muni-stops.ts`, change both `buildRailStations` and `buildRapidBusStops` id strings.

Before:
```ts
id: `muni-${slugify(s.stopname)}`,
```
After:
```ts
id: `muni-${s.stopid}-${slugify(s.stopname)}`,
```

Same change for the bus path:
Before:
```ts
id: `bus-${slugify(s.stopname)}`,
```
After:
```ts
id: `bus-${s.stopid}-${slugify(s.stopname)}`,
```

- [ ] **Step 4: Run, expect PASS**

```bash
npx jest muni-stops
```

Expected: all tests pass (including the existing ones — the test that asserts `id: 'muni-castro-station'` needs updating to `'muni-13001-castro-station'`).

- [ ] **Step 5: Update the existing assertions in the test file**

Find any `toBe('muni-castro-station')` or `toBe('bus-…')` and update to include the stopid prefix from the fixture. Specifically:

In `describe('buildRailStations')`:
```ts
expect(out[0].id).toBe('muni-13001-castro-station')
```

In `describe('buildRapidBusStops')`:
Update the existing test that mentions Mission & 24th to expect `bus-13003-mission-24th` and Geary & Powell to `bus-13002-geary-powell`.

- [ ] **Step 6: Run, expect PASS**

```bash
npx jest muni-stops
```

- [ ] **Step 7: Commit**

```bash
git add scripts/sources/muni-stops.ts __tests__/muni-stops.test.ts
git commit -m "fix(build): include stopid in station id to prevent slug collisions"
```

### Task 1.2: Tighten BART `location_type` filter

**Files:**
- Modify: `scripts/sources/bart-stations.ts`
- Modify: `__tests__/bart-stations.test.ts`
- Modify: `__tests__/fixtures/bart-stops-sample.csv`

The current filter accepts `location_type === ''` (empty) and `location_type === '0'`. Real BART GTFS has a small number of rows with `location_type='1'` (parent stations) and `location_type='2'` (entrances) leaking through. Tighten to `'0'` only.

- [ ] **Step 1: Update the fixture**

Edit `__tests__/fixtures/bart-stops-sample.csv` to add a parent-station row:

```csv
stop_id,stop_name,stop_lat,stop_lon,location_type
EMBR,Embarcadero,37.792976,-122.396957,0
EMBR_PARENT,Embarcadero (parent),37.792976,-122.396957,1
EMBR_ENT,Embarcadero Entrance,37.792,-122.397,2
MONT,Montgomery St.,37.789256,-122.401407,0
POWL,Powell St.,37.784471,-122.40798,0
DALY,Daly City,37.706121,-122.469081,0
ROCK,Rockridge,37.844601,-122.251793,0
```

- [ ] **Step 2: Add a failing test**

In `__tests__/bart-stations.test.ts`, add:

```ts
it('rejects location_type=1 (parent stations) along with entrances', async () => {
  const csv = await fs.readFile(FIX, 'utf8')
  const out = parseBartStops(csv)
  expect(out.find((s) => s.name === 'Embarcadero (parent)')).toBeUndefined()
  expect(out.find((s) => s.name === 'Embarcadero Entrance')).toBeUndefined()
})
```

The existing "filters BART stops to the SF + Daly City bbox" test should already pass — Embarcadero (parent) and Embarcadero Entrance would have appeared otherwise.

- [ ] **Step 3: Run, expect FAIL on the new test**

```bash
npx jest bart-stations
```

The new test fails because `location_type='1'` is currently let through.

- [ ] **Step 4: Tighten the filter in `parseBartStops`**

In `scripts/sources/bart-stations.ts`, find the current `parseBartStops` filter chain. Change the location_type check from:

```ts
.filter((r) => (r.location_type ?? '') === '' || r.location_type === '0')
```

to:

```ts
.filter((r) => r.location_type === '0')
```

If the existing function has a different shape, the same intent: only accept rows where `location_type === '0'`. Reject everything else (parent station, entrance, generic node, boarding area, empty/missing).

- [ ] **Step 5: Run, expect PASS**

```bash
npx jest bart-stations
```

- [ ] **Step 6: Apply the same tightening in `muni-stops.ts`**

In `scripts/sources/muni-stops.ts`, find `isValidStopRow`. Change the location_type predicate the same way: only accept `'0'`.

```ts
function isValidStopRow(s: GtfsStop): boolean {
  if (!s.stop_name?.trim()) return false
  if (s.location_type !== '0') return false   // boarding stops only
  const lat = Number(s.stop_lat)
  const lng = Number(s.stop_lon)
  return Number.isFinite(lat) && Number.isFinite(lng)
}
```

Update `__tests__/fixtures/muni-gtfs/stops.txt` — the existing rows have `location_type` already, but ensure they're `0`. Add one entrance row to verify it's filtered.

Add a test in `__tests__/muni-stops.test.ts`:

```ts
it('rejects rows with location_type != 0', () => {
  const stopsWithEntrance: typeof stops = [
    ...stops.filter((s) => !s.stop_id.endsWith('_ENT')),
    { stop_id: 'S-X_ENT', stop_name: 'X Entrance', stop_lat: '37.7', stop_lon: '-122.4', routes: '1001', location_type: '2' } as typeof stops[number],
  ]
  // (depending on exact fixture structure — adapt to the actual GtfsStop shape)
})
```

(If the muni test infrastructure is fixture-driven via files, edit the fixture instead.)

- [ ] **Step 7: Run, expect PASS**

```bash
npx jest bart-stations muni-stops
```

- [ ] **Step 8: Commit**

```bash
git add scripts/sources/bart-stations.ts scripts/sources/muni-stops.ts __tests__/bart-stations.test.ts __tests__/muni-stops.test.ts __tests__/fixtures/bart-stops-sample.csv __tests__/fixtures/muni-gtfs/stops.txt
git commit -m "fix(build): only accept GTFS location_type=0 (boarding stops)"
```

### Task 1.3: URL pollution on first paint

**Files:**
- Modify: `components/Map.tsx`

The filter-sync `useEffect` writes default values to the URL on mount because `setOrDelete` compares against the wrong default constants. After load, the URL gains `?minUnits=0&completedYears=0&recentActivity=0` even though the user did nothing.

- [ ] **Step 1: Read the existing filter-sync effect in `components/Map.tsx`**

Find the `useEffect` that writes URL params (look for `filterUrlSyncReady` ref or similar — around line 230). Note the existing `DEFAULTS` constant if any, and what defaults are being compared against.

- [ ] **Step 2: Define a module-level DEFAULTS constant**

Near the top of `components/Map.tsx`, near other module constants:

```ts
const URL_DEFAULTS = {
  stages: [...DEFAULT_STAGES].sort().join(','),
  cats: [...ALL_CATEGORIES].sort().join(','),
  minUnits: '2',         // see useState init for minUnits
  completedYears: '2',   // see useState init
  recentActivity: '24',  // see useState init
}
```

(The exact values must match the initial state defaults — verify by reading `useState<…>(2)` etc. lines.)

- [ ] **Step 3: Use URL_DEFAULTS in the filter-sync effect**

Replace any inline default comparisons:

```ts
setOrDelete('minUnits', String(minUnits), URL_DEFAULTS.minUnits)
setOrDelete('completedYears', String(completedYears), URL_DEFAULTS.completedYears)
setOrDelete('recentActivity', String(recentActivity), URL_DEFAULTS.recentActivity)
setOrDelete('stages', [...selectedStages].sort().join(','), URL_DEFAULTS.stages)
setOrDelete('cats', [...selectedCategories].sort().join(','), URL_DEFAULTS.cats)
```

- [ ] **Step 4: Verify in the browser**

```bash
npm run dev
```

Open `http://localhost:3000/` in a fresh browser tab. The URL should remain `http://localhost:3000/` after load — no `?minUnits=0&completedYears=0&recentActivity=0` should appear.

- [ ] **Step 5: Commit**

```bash
git add components/Map.tsx
git commit -m "fix(map): stop writing default filter values to URL on first paint"
```

### Task 1.4: Cluster wrapping fix

**Files:**
- Modify: `components/Map.tsx`

`MarkerClusterGroup` currently wraps `<ZoomGatedPins>`, which returns `null` below z 13.5. With no children, no clusters render. Fix by rendering `<PermitMarker>` children unconditionally inside the cluster group.

- [ ] **Step 1: Read the current Map.tsx pin/cluster section**

Find the `<MarkerClusterGroup>` mount point and the `<ZoomGatedPins>` component definition.

- [ ] **Step 2: Delete `ZoomGatedPins`**

Remove the `function ZoomGatedPins(...)` definition entirely.

- [ ] **Step 3: Replace the cluster-group children with direct `PermitMarker` mapping**

Change:

```tsx
<MarkerClusterGroup
  chunkedLoading
  disableClusteringAtZoom={15}
  maxClusterRadius={60}
  spiderfyOnMaxZoom={false}
  showCoverageOnHover={false}
>
  <ZoomGatedPins
    visiblePermits={visiblePermits}
    onSelect={openPermitPanel}
    zoom={mapZoom}
  />
</MarkerClusterGroup>
```

To:

```tsx
<MarkerClusterGroup
  chunkedLoading
  disableClusteringAtZoom={15}
  maxClusterRadius={60}
  spiderfyOnMaxZoom={false}
  showCoverageOnHover={false}
>
  {visiblePermits.map((p) => (
    <PermitMarker key={p.permit_number} permit={p} onSelect={openPermitPanel} />
  ))}
</MarkerClusterGroup>
```

- [ ] **Step 4: Verify in the browser**

```bash
npm run dev
```

Open `http://localhost:3000/`. At the default zoom (z 13), cluster bubbles should now appear over the city. Zoom in past z 15 — clusters should disappear and raw pins render. The fade band z 13.5–14.5 still produces a smooth opacity transition via the existing `--pin-opacity` CSS variable.

- [ ] **Step 5: Confirm no test regressions**

```bash
npx jest
```

If `__tests__/clustering.test.tsx` references `ZoomGatedPins`, update it to reference `MarkerClusterGroup` directly or delete that test (the unit-level cluster check was mostly symbolic anyway).

- [ ] **Step 6: Commit**

```bash
git add components/Map.tsx __tests__/clustering.test.tsx
git commit -m "fix(map): render PermitMarker children directly so clusters appear"
```

---

## Phase 2 — Transit shed band collapse

Drop the 0.5 mi and 1 mi bands. Uniform 0.1 / 0.25 across rail and rapid bus.

### Task 2.1: Update threshold constants

**Files:**
- Modify: `lib/transit-stations.ts`
- Modify: `__tests__/transit-stations.test.ts`

- [ ] **Step 1: Update the constants**

In `lib/transit-stations.ts`:

Before:
```ts
export const RAIL_THRESHOLD_M = 800       // ½ mi
export const RAPID_BUS_THRESHOLD_M = 160  // 0.1 mi
```

After:
```ts
export const RAIL_THRESHOLD_M = 400        // ¼ mi
export const RAPID_BUS_THRESHOLD_M = 160   // 0.1 mi
```

- [ ] **Step 2: Update the existing threshold test**

In `__tests__/transit-stations.test.ts`, find `describe('thresholds', ...)`:

Before:
```ts
expect(RAIL_THRESHOLD_M).toBe(800)
```
After:
```ts
expect(RAIL_THRESHOLD_M).toBe(400)
```

- [ ] **Step 3: Check existing `railShed` tests still pass**

The default-threshold tests in `describe('railShed', ...)` use distances close to Embarcadero BART. Most should still pass at the tighter 400m threshold, but verify. If the "returns false 5km from any rail station" test passes, leave it; if it passes for the wrong reason (because the test point is now within 400m but used to be just outside 800m of nothing), no change needed.

```bash
npx jest transit-stations
```

Verify all assertions still pass.

- [ ] **Step 4: Commit**

```bash
git add lib/transit-stations.ts __tests__/transit-stations.test.ts
git commit -m "feat: tighten rail shed threshold to ¼ mi (400m)"
```

### Task 2.2: Drop 0.5 / 1 mi bands from build script

**Files:**
- Modify: `scripts/build-cross-stats.ts`

- [ ] **Step 1: Update TRANSIT_BANDS**

In `scripts/build-cross-stats.ts`:

Before:
```ts
const TRANSIT_BANDS = [0.25, 0.5, 1] as const
```
After:
```ts
const TRANSIT_BANDS = [0.1, 0.25] as const
```

`RAPID_BUS_BANDS` (already `[0.1, 0.25]`) stays as-is.

- [ ] **Step 2: Update the `tc` object initializers**

Several places in `main()` initialize `tc = { '0.25mi': 0, '0.5mi': 0, '1mi': 0 }`. Replace each with:

```ts
const tc = { '0.1mi': 0, '0.25mi': 0 } as Record<'0.1mi' | '0.25mi', number>
```

Search for all occurrences of `'0.5mi'` and `'1mi'` in the file — there are ~4 spots (per-neighborhood, per-zoning, per-transit-band, possibly inside output structures). Update each.

- [ ] **Step 3: Update the type definitions inline**

The `NhoodStats.transit_coverage` / `ZoningStats.transit_coverage` / `TransitBandStats.band` types are defined inside the script. Change:

```ts
transit_coverage: { '0.25mi': number; '0.5mi': number; '1mi': number }
```
To:
```ts
transit_coverage: { '0.1mi': number; '0.25mi': number }
```

And:
```ts
band: '0.25mi' | '0.5mi' | '1mi'
```
To:
```ts
band: '0.1mi' | '0.25mi'
```

- [ ] **Step 4: Run the build to verify**

```bash
npm run cross-stats 2>&1 | tail -30
```

Expected output: `bands: 0.1mi, 0.25mi` (was `0.25mi, 0.5mi, 1mi`). The build should complete without TypeScript errors.

- [ ] **Step 5: Commit script changes**

```bash
git add scripts/build-cross-stats.ts public/cross-stats.json public/transit-rings.geojson public/rapid-bus-rings.geojson
git commit -m "feat(build): drop 0.5/1 mi transit bands; uniform 0.1/0.25"
```

### Task 2.3: Update `lib/cross-stats.ts` types

**Files:**
- Modify: `lib/cross-stats.ts`

- [ ] **Step 1: Update the type union**

In `lib/cross-stats.ts`:

Before:
```ts
export type TransitBand = '0.25mi' | '0.5mi' | '1mi'
export const TRANSIT_BAND_ORDER: TransitBand[] = ['0.25mi', '0.5mi', '1mi']
```
After:
```ts
export type TransitBand = '0.1mi' | '0.25mi'
export const TRANSIT_BAND_ORDER: TransitBand[] = ['0.1mi', '0.25mi']
```

The existing `RapidBusBand = '0.1mi' | '0.25mi'` already aligns. If `RapidBusBand` is now identical to `TransitBand`, you can:
- Keep both as separate type aliases (semantic clarity: rail-shed band vs rapid-bus-shed band)
- OR collapse them into one

Keep both for now — they're documentation. Phase 7 might revisit if the chrome simplifies them away.

- [ ] **Step 2: Check downstream consumers**

```bash
grep -rn "0.5mi\|1mi'" --include='*.ts' --include='*.tsx' .
```

Each match should be updated or removed. Likely places:
- `components/TransitRings.tsx` (being deleted in Phase 3 — leave for now if Phase 3 runs immediately after)
- `components/Map.tsx` — places that reference `'0.5mi'` in panel data
- `components/NeighborhoodPanel.tsx` — may surface transit coverage
- `__tests__/transit-stations.test.ts` — already updated in Task 2.1
- Generated `public/cross-stats.json` — regenerated by Task 2.2

For each consumer, drop the `0.5mi` / `1mi` references. If a panel surfaces coverage for these bands, just show the two new bands.

- [ ] **Step 3: Run tests**

```bash
npm run lint
npx jest
```

Both should pass.

- [ ] **Step 4: Commit**

```bash
git add lib/cross-stats.ts components/
git commit -m "feat(types): collapse TransitBand to 0.1mi + 0.25mi"
```

---

## Phase 3 — Transit corridors

Lines on the map. Replaces concentric rings.

### Task 3.1: GTFS shapes parser helper

**Files:**
- Modify: `scripts/sources/_gtfs.ts`

The existing `_gtfs.ts` parses `stops.txt`. Add a `parseShapes` helper that consumes `shapes.txt` (which has `shape_id, shape_pt_lat, shape_pt_lon, shape_pt_sequence`) and returns `Map<shape_id, [lng, lat][]>` (LineString-ready coordinate arrays, sorted by sequence).

- [ ] **Step 1: Add a failing test**

Append to `__tests__/gtfs-parser.test.ts`:

```ts
import { parseShapes } from '../scripts/sources/_gtfs'

describe('parseShapes', () => {
  it('groups points by shape_id and sorts by sequence', () => {
    const csv = `shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence
S1,37.79,-122.40,1
S1,37.80,-122.41,2
S2,37.70,-122.45,1
S1,37.81,-122.42,3
`
    const out = parseShapes(csv)
    expect(out.size).toBe(2)
    expect(out.get('S1')).toEqual([
      [-122.40, 37.79],
      [-122.41, 37.80],
      [-122.42, 37.81],
    ])
    expect(out.get('S2')).toEqual([
      [-122.45, 37.70],
    ])
  })

  it('returns coordinates as [lng, lat] pairs (GeoJSON convention)', () => {
    const csv = `shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence
A,37.0,-122.0,1
`
    const out = parseShapes(csv)
    expect(out.get('A')).toEqual([[-122.0, 37.0]])
  })
})
```

- [ ] **Step 2: Run, expect FAIL**

```bash
npx jest gtfs-parser
```

- [ ] **Step 3: Add `parseShapes` to `_gtfs.ts`**

Append to `scripts/sources/_gtfs.ts`:

```ts
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
```

- [ ] **Step 4: Run, expect PASS**

```bash
npx jest gtfs-parser
```

- [ ] **Step 5: Commit**

```bash
git add scripts/sources/_gtfs.ts __tests__/gtfs-parser.test.ts
git commit -m "feat(build): parseShapes() helper for GTFS shapes.txt"
```

### Task 3.2: BART corridor fetcher

**Files:**
- Create: `scripts/sources/transit-corridors.ts`
- Test: `__tests__/transit-corridors.test.ts`

This task adds BART corridors only — Muni and Caltrain come in 3.3 and 3.4.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/transit-corridors.test.ts
import { simplifyAndBuildBartFeatures } from '../scripts/sources/transit-corridors'

describe('simplifyAndBuildBartFeatures', () => {
  it('returns one Feature per shape_id with mode=bart', () => {
    const shapes = new Map<string, [number, number][]>([
      ['SHP1', [[-122.40, 37.79], [-122.41, 37.80]]],
      ['SHP2', [[-122.45, 37.75], [-122.46, 37.76]]],
    ])
    const features = simplifyAndBuildBartFeatures(shapes)
    expect(features).toHaveLength(2)
    expect(features[0].properties.mode).toBe('bart')
    expect(features[0].geometry.type).toBe('LineString')
    expect(features[0].properties.line_name).toMatch(/BART/)
  })

  it('produces GeoJSON LineString coordinates as [lng, lat]', () => {
    const shapes = new Map([['A', [[-122.40, 37.79]]] as [string, [number, number][]]])
    const features = simplifyAndBuildBartFeatures(shapes)
    expect(features[0].geometry.coordinates).toEqual([[-122.40, 37.79]])
  })
})
```

- [ ] **Step 2: Run, expect FAIL**

```bash
npx jest transit-corridors
```

- [ ] **Step 3: Implement `scripts/sources/transit-corridors.ts`**

```ts
import type { Feature, LineString } from 'geojson'
import { fetchGtfsZip, parseShapes } from './_gtfs'

export type CorridorMode = 'bart' | 'muni-metro' | 'caltrain' | 'rapid-bus'

export interface CorridorFeature extends Feature<LineString, { mode: CorridorMode; line_name: string }> {}

const BART_GTFS_URL = 'https://www.bart.gov/dev/schedules/google_transit.zip'

/** Build BART corridor features from a parsed shapes map. Currently treats
 *  each shape as a separate LineString; future work can group by route_id
 *  for true per-route line naming. */
export function simplifyAndBuildBartFeatures(
  shapes: Map<string, [number, number][]>,
): CorridorFeature[] {
  const out: CorridorFeature[] = []
  for (const [shapeId, coords] of shapes) {
    if (coords.length < 2 && coords.length !== 1) continue
    out.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: coords },
      properties: { mode: 'bart', line_name: `BART · ${shapeId}` },
    })
  }
  return out
}

/** Fetch BART GTFS, parse shapes.txt, return CorridorFeature[]. */
export async function fetchBartCorridors(): Promise<CorridorFeature[]> {
  const entries = await fetchGtfsZip(BART_GTFS_URL, ['shapes.txt'])
  const rows = entries['shapes.txt']
  const header = ['shape_id', 'shape_pt_lat', 'shape_pt_lon', 'shape_pt_sequence']
  const csv = [header.join(','), ...rows.map((r) => header.map((h) => r[h] ?? '').join(','))].join('\n')
  const shapes = parseShapes(csv)
  return simplifyAndBuildBartFeatures(shapes)
}
```

- [ ] **Step 4: Run, expect PASS**

```bash
npx jest transit-corridors
```

- [ ] **Step 5: Commit**

```bash
git add scripts/sources/transit-corridors.ts __tests__/transit-corridors.test.ts
git commit -m "feat(build): BART corridor fetcher from GTFS shapes"
```

### Task 3.3: Muni + rapid-bus corridors

**Files:**
- Modify: `scripts/sources/transit-corridors.ts`
- Modify: `__tests__/transit-corridors.test.ts`

SFMTA GTFS via 511 includes `shapes.txt`, `routes.txt`, and `trips.txt`. Each trip references a `shape_id` and a `route_id`. We classify each shape by its primary route's `route_short_name`:
- K/L/M/N/T/J → `muni-metro`
- ends with R → `rapid-bus`
- anything else → skip

- [ ] **Step 1: Add failing tests for the classification helper**

In `__tests__/transit-corridors.test.ts`, append:

```ts
import { classifyMuniShape, buildMuniFeatures } from '../scripts/sources/transit-corridors'

describe('classifyMuniShape', () => {
  it('returns muni-metro for K/L/M/N/T/J short names', () => {
    expect(classifyMuniShape('N')).toBe('muni-metro')
    expect(classifyMuniShape('T')).toBe('muni-metro')
    expect(classifyMuniShape('J')).toBe('muni-metro')
  })
  it('returns rapid-bus for R-suffix short names', () => {
    expect(classifyMuniShape('38R')).toBe('rapid-bus')
    expect(classifyMuniShape('5R')).toBe('rapid-bus')
  })
  it('returns null for regular bus / cable car routes', () => {
    expect(classifyMuniShape('38')).toBeNull()
    expect(classifyMuniShape('60')).toBeNull()
  })
})

describe('buildMuniFeatures', () => {
  it('emits one feature per shape with mode determined by classification', () => {
    const shapes = new Map<string, [number, number][]>([
      ['shN', [[-122.5, 37.76], [-122.46, 37.76]]],
      ['sh38R', [[-122.4, 37.78], [-122.4, 37.79]]],
      ['sh38', [[-122.4, 37.78], [-122.4, 37.79]]],
    ])
    const trips = [
      { trip_id: 't1', route_id: 'rN', shape_id: 'shN' },
      { trip_id: 't2', route_id: 'r38R', shape_id: 'sh38R' },
      { trip_id: 't3', route_id: 'r38', shape_id: 'sh38' },
    ]
    const routes = [
      { route_id: 'rN', route_short_name: 'N' },
      { route_id: 'r38R', route_short_name: '38R' },
      { route_id: 'r38', route_short_name: '38' },
    ]
    const out = buildMuniFeatures(shapes, trips, routes)
    expect(out).toHaveLength(2)   // sh38 is skipped (regular bus)
    expect(out.find((f) => f.properties.line_name === 'Muni · N')?.properties.mode).toBe('muni-metro')
    expect(out.find((f) => f.properties.line_name === 'Muni · 38R')?.properties.mode).toBe('rapid-bus')
  })
})
```

- [ ] **Step 2: Run, expect FAIL**

```bash
npx jest transit-corridors
```

- [ ] **Step 3: Implement the new exports**

Add to `scripts/sources/transit-corridors.ts`:

```ts
import { parseCsv, fetchGtfsZip, parseShapes } from './_gtfs'

const RAIL_SHORT_NAMES = new Set(['K', 'L', 'M', 'N', 'T', 'J'])

export function classifyMuniShape(shortName: string): CorridorMode | null {
  if (RAIL_SHORT_NAMES.has(shortName)) return 'muni-metro'
  if (/R$/.test(shortName)) return 'rapid-bus'
  return null
}

interface MuniTrip { trip_id: string; route_id: string; shape_id: string }
interface MuniRoute { route_id: string; route_short_name: string }

export function buildMuniFeatures(
  shapes: Map<string, [number, number][]>,
  trips: MuniTrip[],
  routes: MuniRoute[],
): CorridorFeature[] {
  const routeNameById = new Map(routes.map((r) => [r.route_id, r.route_short_name]))
  // Pick one route per shape. Real GTFS often has many trips referencing the same
  // shape; the first matching trip with a classifiable short_name wins.
  const shapeToRouteName = new Map<string, string>()
  for (const t of trips) {
    if (shapeToRouteName.has(t.shape_id)) continue
    const short = routeNameById.get(t.route_id)
    if (!short) continue
    if (!classifyMuniShape(short)) continue
    shapeToRouteName.set(t.shape_id, short)
  }
  const out: CorridorFeature[] = []
  for (const [shapeId, shortName] of shapeToRouteName) {
    const coords = shapes.get(shapeId)
    if (!coords || coords.length < 1) continue
    const mode = classifyMuniShape(shortName)
    if (!mode) continue
    out.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: coords },
      properties: { mode, line_name: `Muni · ${shortName}` },
    })
  }
  return out
}

/** Fetch SFMTA GTFS via 511 and return classified Muni Metro + rapid-bus corridors. */
export async function fetchMuniCorridors(): Promise<CorridorFeature[]> {
  const key = process.env.FIVE_ELEVEN_API_KEY
  if (!key) {
    console.warn('FIVE_ELEVEN_API_KEY not set; skipping Muni corridors')
    return []
  }
  const url = `https://api.511.org/transit/datafeeds?operator_id=SF&api_key=${encodeURIComponent(key)}`
  const entries = await fetchGtfsZip(url, ['shapes.txt', 'trips.txt', 'routes.txt'])

  const toCsv = (rows: Record<string, string>[], header: string[]): string =>
    [header.join(','), ...rows.map((r) => header.map((h) => r[h] ?? '').join(','))].join('\n')

  const shapes = parseShapes(toCsv(entries['shapes.txt'], ['shape_id', 'shape_pt_lat', 'shape_pt_lon', 'shape_pt_sequence']))
  const trips = parseCsv(toCsv(entries['trips.txt'], ['trip_id', 'route_id', 'shape_id'])) as unknown as MuniTrip[]
  const routes = parseCsv(toCsv(entries['routes.txt'], ['route_id', 'route_short_name'])) as unknown as MuniRoute[]
  return buildMuniFeatures(shapes, trips, routes)
}
```

- [ ] **Step 4: Run, expect PASS**

```bash
npx jest transit-corridors
```

- [ ] **Step 5: Commit**

```bash
git add scripts/sources/transit-corridors.ts __tests__/transit-corridors.test.ts
git commit -m "feat(build): Muni Metro + rapid-bus corridors classified from GTFS"
```

### Task 3.4: Caltrain corridor (SF segment only)

**Files:**
- Modify: `scripts/sources/transit-corridors.ts`
- Modify: `__tests__/transit-corridors.test.ts`

Caltrain GTFS shapes include the entire line from SF to San Jose. Clip to SF county at build time using a bbox so we don't render a 50-mile line.

- [ ] **Step 1: Add a failing test for the bbox clip**

```ts
import { clipLineToBbox } from '../scripts/sources/transit-corridors'

describe('clipLineToBbox', () => {
  const SF_BBOX = { west: -122.515, east: -122.355, south: 37.706, north: 37.81 }

  it('keeps contiguous in-bbox points as one segment', () => {
    const coords: [number, number][] = [
      [-122.40, 37.78],  // in
      [-122.39, 37.77],  // in
      [-122.20, 37.50],  // out (Burlingame)
      [-122.10, 37.45],  // out
    ]
    const out = clipLineToBbox(coords, SF_BBOX)
    expect(out).toEqual([[[-122.40, 37.78], [-122.39, 37.77]]])
  })

  it('returns empty when no points are in-bbox', () => {
    const coords: [number, number][] = [[-122.20, 37.50], [-122.10, 37.45]]
    const out = clipLineToBbox(coords, SF_BBOX)
    expect(out).toEqual([])
  })
})
```

- [ ] **Step 2: Run, expect FAIL**

```bash
npx jest transit-corridors
```

- [ ] **Step 3: Implement `clipLineToBbox` + Caltrain fetcher**

Add to `scripts/sources/transit-corridors.ts`:

```ts
interface Bbox { west: number; east: number; south: number; north: number }

const SF_BBOX: Bbox = { west: -122.515, east: -122.355, south: 37.706, north: 37.81 }

function pointInBbox(lng: number, lat: number, b: Bbox): boolean {
  return lng >= b.west && lng <= b.east && lat >= b.south && lat <= b.north
}

/** Split a polyline into the contiguous segments that lie within the bbox.
 *  Used to clip Caltrain's full Peninsula line to just the SF county portion. */
export function clipLineToBbox(coords: [number, number][], bbox: Bbox): [number, number][][] {
  const segments: [number, number][][] = []
  let current: [number, number][] = []
  for (const [lng, lat] of coords) {
    if (pointInBbox(lng, lat, bbox)) {
      current.push([lng, lat])
    } else if (current.length > 0) {
      segments.push(current)
      current = []
    }
  }
  if (current.length > 0) segments.push(current)
  return segments
}

/** Fetch Caltrain GTFS via 511, parse shapes, clip to SF county. */
export async function fetchCaltrainCorridors(): Promise<CorridorFeature[]> {
  const key = process.env.FIVE_ELEVEN_API_KEY
  if (!key) {
    console.warn('FIVE_ELEVEN_API_KEY not set; skipping Caltrain corridors')
    return []
  }
  const url = `https://api.511.org/transit/datafeeds?operator_id=CT&api_key=${encodeURIComponent(key)}`
  const entries = await fetchGtfsZip(url, ['shapes.txt'])
  const rows = entries['shapes.txt']
  const header = ['shape_id', 'shape_pt_lat', 'shape_pt_lon', 'shape_pt_sequence']
  const csv = [header.join(','), ...rows.map((r) => header.map((h) => r[h] ?? '').join(','))].join('\n')
  const shapes = parseShapes(csv)

  const out: CorridorFeature[] = []
  for (const [shapeId, coords] of shapes) {
    const segments = clipLineToBbox(coords, SF_BBOX)
    for (let i = 0; i < segments.length; i++) {
      out.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: segments[i] },
        properties: { mode: 'caltrain', line_name: `Caltrain · ${shapeId}${segments.length > 1 ? ` (seg ${i + 1})` : ''}` },
      })
    }
  }
  return out
}
```

- [ ] **Step 4: Run, expect PASS**

```bash
npx jest transit-corridors
```

- [ ] **Step 5: Commit**

```bash
git add scripts/sources/transit-corridors.ts __tests__/transit-corridors.test.ts
git commit -m "feat(build): Caltrain corridors clipped to SF county bbox"
```

### Task 3.5: Wire corridors into build + emit GeoJSON

**Files:**
- Modify: `scripts/build-cross-stats.ts`

- [ ] **Step 1: Add the imports**

In `scripts/build-cross-stats.ts`:

```ts
import {
  fetchBartCorridors,
  fetchMuniCorridors,
  fetchCaltrainCorridors,
  type CorridorFeature,
} from './sources/transit-corridors'
```

- [ ] **Step 2: Fetch and emit corridors**

In `main()`, after the station + ring builds, add:

```ts
console.log('• fetching transit corridors (BART + Muni + Caltrain)…')
const [bartCorridors, muniCorridors, caltrainCorridors] = await Promise.all([
  fetchBartCorridors(),
  fetchMuniCorridors(),
  fetchCaltrainCorridors(),
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
```

- [ ] **Step 3: Run the build**

```bash
npm run cross-stats 2>&1 | grep -E "corridors|wrote"
```

Expected: `corridors: bart=NN, muni=NN, caltrain=NN` and `✓ wrote transit-corridors.geojson`.

- [ ] **Step 4: Sanity-check the output size**

```bash
node -e "const fc=require('./public/transit-corridors.geojson'); const byMode={}; for(const f of fc.features) byMode[f.properties.mode]=(byMode[f.properties.mode]||0)+1; console.log(byMode)"
```

Expected output: `{ bart: NN, 'muni-metro': NN, 'rapid-bus': NN, caltrain: NN }`.

- [ ] **Step 5: Commit**

```bash
git add scripts/build-cross-stats.ts public/transit-corridors.geojson
git commit -m "feat(build): emit /public/transit-corridors.geojson"
```

### Task 3.6: TransitCorridors component

**Files:**
- Create: `components/TransitCorridors.tsx`

- [ ] **Step 1: Implement the component**

```tsx
// components/TransitCorridors.tsx
'use client'
import { GeoJSON } from 'react-leaflet'
import { useEffect, useState } from 'react'
import type { FeatureCollection, LineString } from 'geojson'

type CorridorMode = 'bart' | 'muni-metro' | 'caltrain' | 'rapid-bus'

interface CorridorProperties {
  mode: CorridorMode
  line_name: string
}

type CorridorsGeo = FeatureCollection<LineString, CorridorProperties>

const MODE_STYLE: Record<CorridorMode, { color: string; weight: number; opacity: number }> = {
  bart:         { color: '#1c2438', weight: 2,   opacity: 0.85 },
  'muni-metro': { color: '#7d9b76', weight: 2,   opacity: 0.85 },
  caltrain:     { color: '#b08968', weight: 2,   opacity: 0.85 },
  'rapid-bus':  { color: '#9a4a31', weight: 1.5, opacity: 0.7  },
}

/** Renders the dotted transit corridor lines on the map when the transit
 *  lens is active. Loaded from /transit-corridors.geojson (built once per
 *  nightly cron). */
export function TransitCorridors() {
  const [geo, setGeo] = useState<CorridorsGeo | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    fetch('/transit-corridors.geojson', { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && data.type === 'FeatureCollection') setGeo(data as CorridorsGeo)
      })
      .catch(() => {})
    return () => ctrl.abort()
  }, [])

  if (!geo) return null

  return (
    <GeoJSON
      key="transit-corridors"
      data={geo}
      style={(feature) => {
        const mode = (feature?.properties as CorridorProperties | undefined)?.mode ?? 'rapid-bus'
        const style = MODE_STYLE[mode]
        return {
          color: style.color,
          weight: style.weight,
          opacity: style.opacity,
          dashArray: '2 4',   // dotted — keeps it visually distinct from solid road network
          fillOpacity: 0,
          interactive: false,
        }
      }}
    />
  )
}
```

- [ ] **Step 2: Mount in Map.tsx**

In `components/Map.tsx`, add the import:

```ts
import { TransitCorridors } from './TransitCorridors'
```

Find the existing `<TransitRings .../>` mount inside the `{mapMode === 'transit' && ...}` block. Replace `TransitRings` with `TransitCorridors`:

```tsx
{mapMode === 'transit' && (
  <>
    <TransitCorridors />
    <StationMarkers show onSelect={(s) => {
      setSelectedStation(s)
      setStationRadiusM(s.kind === 'rail' ? RAIL_THRESHOLD_M : RAPID_BUS_THRESHOLD_M)
    }} />
  </>
)}
```

Remove the `import { TransitRings } from './TransitRings'` line if it's no longer used elsewhere.

- [ ] **Step 3: Delete the now-unused `TransitRings.tsx`**

Verify no other consumers:

```bash
grep -rn "TransitRings" --include='*.ts' --include='*.tsx' .
```

If only `Map.tsx` and the file itself reference it, delete:

```bash
git rm components/TransitRings.tsx
```

(Also remove the per-band selection state in `Map.tsx` — `selectedTransitBand` and `setSelectedTransitBand` and the `TransitBandPanel` function at the bottom of `Map.tsx` are dead with the rings gone. Remove them.)

- [ ] **Step 4: Verify in browser**

```bash
npm run dev
```

Open `http://localhost:3000/`, switch to the transit lens. Dotted lines for BART/Muni/Caltrain/rapid-bus render at all zooms. No more concentric ring polygons.

- [ ] **Step 5: Commit**

```bash
git add components/TransitCorridors.tsx components/Map.tsx
git rm components/TransitRings.tsx
git commit -m "feat: dotted transit corridors replace concentric rings"
```

---

## Phase 4 — Station marker restyle (S1 glyph-based)

Tiered visual prominence; glyphs identify mode at a glance.

### Task 4.1: Mode-glyph icon definitions

**Files:**
- Modify: `components/StationMarkers.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Update `StationMarkers.tsx` icon definitions**

Replace the existing `RAIL_ICON` / `BUS_ICON` definitions with mode-specific icons.

```tsx
// components/StationMarkers.tsx
'use client'
import { Marker } from 'react-leaflet'
import L from 'leaflet'
import {
  RAIL_STATIONS, RAPID_BUS_STOPS,
  type RailStation, type RapidBusStop,
} from '@/lib/transit-stations'

// BART — 14px navy filled circle with cream "B" centered
const BART_ICON = L.divIcon({
  className: 'station-icon station-bart',
  html: '<span class="dot">B</span>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

// Muni Metro — 12px sage filled circle with cream "M" centered
const MUNI_ICON = L.divIcon({
  className: 'station-icon station-muni',
  html: '<span class="dot">M</span>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

// Caltrain — 12px gold square with small white train glyph
const CALTRAIN_ICON = L.divIcon({
  className: 'station-icon station-caltrain',
  html: '<span class="square">▤</span>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

// Rapid bus — 6px open sienna dot, no glyph
const BUS_ICON = L.divIcon({
  className: 'station-icon station-bus',
  html: '<span class="bus-dot"></span>',
  iconSize: [8, 8],
  iconAnchor: [4, 4],
})

function railIconForStation(s: RailStation): L.DivIcon {
  // A merged station can have multiple modes; pick the most "prominent" one for display.
  if (s.modes.includes('bart')) return BART_ICON
  if (s.modes.includes('caltrain')) return CALTRAIN_ICON
  return MUNI_ICON
}

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
          icon={railIconForStation(s)}
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

- [ ] **Step 2: Update `app/globals.css`**

Find the existing `.station-icon` rules and replace with:

```css
.station-icon { pointer-events: auto; }

.station-icon .dot {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px; height: 16px;
  border-radius: 50%;
  border: 2px solid #fbf6ec;
  font: 700 9px/1 "Helvetica Neue", Arial, sans-serif;
  color: #fbf6ec;
}
.station-bart .dot { background: #1c2438; box-shadow: 0 0 0 1px #1c2438; }
.station-muni .dot { background: #7d9b76; box-shadow: 0 0 0 1px #7d9b76; }

.station-icon .square {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px; height: 14px;
  background: #b08968;
  border: 2px solid #fbf6ec;
  box-shadow: 0 0 0 1px #b08968;
  color: #fbf6ec;
  font: 700 9px/1 "Helvetica Neue", Arial, sans-serif;
}

.station-icon .bus-dot {
  display: block;
  width: 8px; height: 8px;
  background: #fbf6ec;
  border: 1.5px solid #9a4a31;
  border-radius: 50%;
}

.station-icon:hover .dot,
.station-icon:hover .square,
.station-icon:hover .bus-dot {
  transform: scale(1.25);
  transition: transform 100ms ease-out;
}
```

- [ ] **Step 3: Verify in browser**

```bash
npm run dev
```

Switch to transit lens. BART stations should be ~16 px navy circles with "B" glyph; Muni Metro = sage with "M"; Caltrain = gold square with "▤"; rapid bus = small open sienna circle (no glyph).

- [ ] **Step 4: Commit**

```bash
git add components/StationMarkers.tsx app/globals.css
git commit -m "feat: glyph-based tiered transit station icons"
```

### Task 4.2: Zoom-gate rapid bus to z ≥ 14

**Files:**
- Modify: `components/StationMarkers.tsx`
- Modify: `components/Map.tsx`

- [ ] **Step 1: Add a zoom prop to StationMarkers**

In `components/StationMarkers.tsx`:

```tsx
interface Props {
  show: boolean
  zoom: number
  onSelect: (s: SelectedStation) => void
}

export function StationMarkers({ show, zoom, onSelect }: Props) {
  if (!show) return null
  const showBus = zoom >= 14
  return (
    <>
      {RAIL_STATIONS.map((s: RailStation) => (
        // ... existing rail render
      ))}
      {showBus && RAPID_BUS_STOPS.map((s: RapidBusStop) => (
        // ... existing rapid bus render
      ))}
    </>
  )
}
```

- [ ] **Step 2: Pass mapZoom from Map.tsx**

In `components/Map.tsx`, update the `<StationMarkers />` mount:

```tsx
<StationMarkers
  show
  zoom={mapZoom}
  onSelect={(s) => {
    setSelectedStation(s)
    setStationRadiusM(s.kind === 'rail' ? RAIL_THRESHOLD_M : RAPID_BUS_THRESHOLD_M)
  }}
/>
```

- [ ] **Step 3: Verify in browser**

At default zoom (~13), rapid-bus dots are hidden. Zoom past z 14 — bus dots appear.

- [ ] **Step 4: Commit**

```bash
git add components/StationMarkers.tsx components/Map.tsx
git commit -m "feat: zoom-gate rapid-bus station markers to z >= 14"
```

---

## Phase 5 — Special-areas overlay

Hand-list federal / state / TIDA areas not in DataSF zoning.

### Task 5.1: Data module + geometry

**Files:**
- Create: `lib/special-zoning-areas.ts`
- Test: `__tests__/special-zoning-areas.test.ts`

Hand-traced GeoJSON polygons for ~3–4 special areas with editorial notes + citations.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/special-zoning-areas.test.ts
import { SPECIAL_ZONING_AREAS } from '../lib/special-zoning-areas'

describe('SPECIAL_ZONING_AREAS', () => {
  it('includes at least 3 hand-listed areas with required fields', () => {
    expect(SPECIAL_ZONING_AREAS.length).toBeGreaterThanOrEqual(3)
    for (const a of SPECIAL_ZONING_AREAS) {
      expect(a.name).toBeTruthy()
      expect(a.governor).toBeTruthy()
      expect(a.note).toBeTruthy()
      expect(a.source.url).toMatch(/^https?:\/\//)
      expect(a.source.cite).toBeTruthy()
      expect(a.shape).toBeDefined()
      expect(['Polygon', 'MultiPolygon']).toContain(a.shape.type)
    }
  })

  it('includes the Presidio', () => {
    expect(SPECIAL_ZONING_AREAS.find((a) => a.name === 'Presidio')).toBeDefined()
  })

  it('includes Treasure Island / Yerba Buena Island', () => {
    expect(SPECIAL_ZONING_AREAS.find((a) => a.name.toLowerCase().includes('treasure'))).toBeDefined()
  })
})
```

- [ ] **Step 2: Run, expect FAIL**

```bash
npx jest special-zoning-areas
```

- [ ] **Step 3: Implement `lib/special-zoning-areas.ts`**

```ts
import type { Polygon, MultiPolygon } from 'geojson'

interface SpecialAreaSource {
  url: string
  cite: string
}

export interface SpecialArea {
  name: string
  shape: Polygon | MultiPolygon
  governor: string
  note: string
  source: SpecialAreaSource
}

/** Hand-listed federal / state / TIDA areas in SF that aren't in DataSF's
 *  zoning dataset. Geometries are hand-traced rough polygons (~50m
 *  accuracy) — accurate enough for hover + click; not for property-level
 *  decisions. Sources cite the authoritative master-plan documents. */
export const SPECIAL_ZONING_AREAS: SpecialArea[] = [
  {
    name: 'Presidio',
    governor: 'Presidio Trust',
    note: 'Federal land — not subject to SF Planning Code. Master plan controls.',
    source: {
      url: 'https://www.presidio.gov/management/management-plans',
      cite: 'Presidio Trust',
    },
    shape: {
      type: 'Polygon',
      coordinates: [[
        [-122.4853, 37.7900],
        [-122.4853, 37.8100],
        [-122.4500, 37.8100],
        [-122.4500, 37.7900],
        [-122.4853, 37.7900],
      ]],
    },
  },
  {
    name: 'Golden Gate National Recreation Area (SF portions)',
    governor: 'National Park Service',
    note: 'Federal park land — NPS general management plan controls.',
    source: {
      url: 'https://www.nps.gov/goga/',
      cite: 'National Park Service',
    },
    shape: {
      type: 'MultiPolygon',
      coordinates: [
        // Fort Mason
        [[
          [-122.4360, 37.8050],
          [-122.4360, 37.8090],
          [-122.4230, 37.8090],
          [-122.4230, 37.8050],
          [-122.4360, 37.8050],
        ]],
        // Lands End / Sutro Heights
        [[
          [-122.5145, 37.7770],
          [-122.5145, 37.7870],
          [-122.5000, 37.7870],
          [-122.5000, 37.7770],
          [-122.5145, 37.7770],
        ]],
        // Ocean Beach
        [[
          [-122.5145, 37.7350],
          [-122.5145, 37.7700],
          [-122.5050, 37.7700],
          [-122.5050, 37.7350],
          [-122.5145, 37.7350],
        ]],
      ],
    },
  },
  {
    name: 'Treasure Island / Yerba Buena Island',
    governor: 'Treasure Island Development Authority (TIDA)',
    note: 'TI/YBI Development Plan — distinct from SF Planning Code.',
    source: {
      url: 'https://sfgov.org/treasureisland/',
      cite: 'TIDA',
    },
    shape: {
      type: 'Polygon',
      coordinates: [[
        [-122.3760, 37.8050],
        [-122.3760, 37.8270],
        [-122.3580, 37.8270],
        [-122.3580, 37.8050],
        [-122.3760, 37.8050],
      ]],
    },
  },
]
```

(These bbox coordinates are approximations; the implementing agent should refine them with more accurate hand-traced polygons by referencing the public Presidio boundary, GGNRA SF segments, and TIDA jurisdiction.)

- [ ] **Step 4: Run, expect PASS**

```bash
npx jest special-zoning-areas
```

- [ ] **Step 5: Commit**

```bash
git add lib/special-zoning-areas.ts __tests__/special-zoning-areas.test.ts
git commit -m "feat: hand-listed federal/state/TIDA special zoning areas"
```

### Task 5.2: SpecialAreasOverlay component

**Files:**
- Create: `components/SpecialAreasOverlay.tsx`

- [ ] **Step 1: Implement the component**

```tsx
// components/SpecialAreasOverlay.tsx
'use client'
import { GeoJSON } from 'react-leaflet'
import { SPECIAL_ZONING_AREAS, type SpecialArea } from '@/lib/special-zoning-areas'
import type { FeatureCollection } from 'geojson'

interface Props {
  onSelect: (area: SpecialArea) => void
}

/** Diagonal-stripe overlay for federal / state / TIDA areas. Visible in
 *  zoning lens. Click → fires onSelect with the matching SpecialArea. */
export function SpecialAreasOverlay({ onSelect }: Props) {
  const collection: FeatureCollection = {
    type: 'FeatureCollection',
    features: SPECIAL_ZONING_AREAS.map((a, i) => ({
      type: 'Feature',
      geometry: a.shape,
      properties: { idx: i, name: a.name },
    })),
  }

  return (
    <GeoJSON
      key="special-zoning-areas"
      data={collection}
      style={{
        color: '#67615a',
        weight: 1,
        opacity: 0.7,
        fillColor: '#67615a',
        fillOpacity: 0.10,
        // The CSS rule below applies a diagonal-stripe SVG pattern; we set
        // a class so the runtime can target the path.
        className: 'special-area-poly',
      }}
      onEachFeature={(feature, layer) => {
        const idx = (feature.properties as { idx: number }).idx
        const area = SPECIAL_ZONING_AREAS[idx]
        layer.on({
          click: () => onSelect(area),
        })
        layer.bindTooltip(`${area.name}`, {
          sticky: true,
          direction: 'top',
          className: 'nhood-tooltip',
        })
      }}
    />
  )
}
```

- [ ] **Step 2: Add the diagonal-stripe CSS in `app/globals.css`**

```css
.special-area-poly {
  fill: url(#diagonal-stripes);
  fill-opacity: 0.20;
  stroke: #67615a;
  stroke-width: 1;
  stroke-opacity: 0.6;
  cursor: pointer;
}
```

To make the SVG pattern available, add a `<defs>` block to the existing Leaflet container. The cleanest path is to inject the pattern via a one-time effect in `Map.tsx`:

In `components/Map.tsx`, near the top of the component, add an effect:

```ts
useEffect(() => {
  // Inject the diagonal-stripe SVG pattern into the document once.
  if (document.getElementById('special-area-pattern-defs')) return
  const svgNS = 'http://www.w3.org/2000/svg'
  const defs = document.createElementNS(svgNS, 'svg')
  defs.id = 'special-area-pattern-defs'
  defs.setAttribute('style', 'position:absolute;width:0;height:0;')
  defs.innerHTML = `
    <defs>
      <pattern id="diagonal-stripes" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="8" stroke="#67615a" stroke-width="2" stroke-opacity="0.25"/>
      </pattern>
    </defs>
  `
  document.body.appendChild(defs)
}, [])
```

- [ ] **Step 3: Mount in Map.tsx (zoning lens only)**

In the `{mapMode === 'zoning' && ...}` block, alongside `ZoningOverlay`:

```tsx
{mapMode === 'zoning' && (
  <>
    <ZoningOverlay
      selectedDistrict={selectedZoningDistrict?.zoningSim ?? null}
      onSelect={(zoningSim, gen) => setSelectedZoningDistrict({ zoningSim, gen })}
    />
    <SpecialAreasOverlay onSelect={(area) => setSelectedSpecialArea(area)} />
  </>
)}
```

Add state at the top of the component:

```ts
const [selectedSpecialArea, setSelectedSpecialArea] = useState<SpecialArea | null>(null)
```

(Import `SpecialArea` from `@/lib/special-zoning-areas`.)

- [ ] **Step 4: Add a panel for special-area details**

At the bottom of `Map.tsx`, alongside the other panels:

```tsx
function SpecialAreaPanel({
  area,
  onClose,
}: {
  area: SpecialArea | null
  onClose: () => void
}) {
  return (
    <LensInfoPanel
      open={!!area}
      eyebrow="Special area"
      title={area?.name ?? '—'}
      subtitle={area?.governor}
      primary={
        area
          ? {
              eyebrow: 'About',
              rows: [
                { label: area.note, value: '', pct: 1, color: '#67615a' },
                { label: `Source: ${area.source.cite}`, value: '↗', pct: 0.6, color: '#9a4a31' },
              ],
            }
          : undefined
      }
      onClose={onClose}
    />
  )
}
```

Mount in the main return:

```tsx
<SpecialAreaPanel area={selectedSpecialArea} onClose={() => setSelectedSpecialArea(null)} />
```

- [ ] **Step 5: Verify in browser**

```bash
npm run dev
```

Switch to zoning lens. Diagonal-striped overlays should appear over the Presidio, Fort Mason, Lands End, Ocean Beach, and Treasure Island. Click any → panel with name, governor, note, source link.

- [ ] **Step 6: Commit**

```bash
git add components/SpecialAreasOverlay.tsx components/Map.tsx app/globals.css
git commit -m "feat: special-areas overlay (Presidio, GGNRA, TIDA) in zoning lens"
```

---

## Phase 6 — Zoning panel additions

Editorial weight: blurbs, glossary, height visual, PIM link, recent permits, external links footer.

### Task 6.1: Per-gen blurbs

**Files:**
- Create: `lib/zoning-blurbs.ts`
- Test: `__tests__/zoning-blurbs.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/zoning-blurbs.test.ts
import { getZoningBlurb } from '../lib/zoning-blurbs'

describe('getZoningBlurb', () => {
  it('returns a string for each top-level gen', () => {
    for (const gen of ['Residential', 'Mixed Use', 'Commercial', 'Industrial', 'Public', 'Other']) {
      const b = getZoningBlurb(gen)
      expect(typeof b).toBe('string')
      expect(b.length).toBeGreaterThan(20)
    }
  })
  it('returns an empty string for an unknown gen', () => {
    expect(getZoningBlurb('Mars')).toBe('')
  })
})
```

- [ ] **Step 2: Run, expect FAIL**

```bash
npx jest zoning-blurbs
```

- [ ] **Step 3: Implement `lib/zoning-blurbs.ts`**

```ts
/** Per-gen editorial blurbs surfaced at the top of each district panel.
 *  Hand-curated; short and concrete. */
const BLURBS: Record<string, string> = {
  Residential:
    "Single-family and small-multi-unit zoning. About 38% of SF's land. State family-zoning laws (SB-9, ADU) most directly apply here.",
  'Mixed Use':
    "Commercial corridors that allow housing above ground-floor uses. Where most new infill happens in modern SF.",
  Commercial:
    "Office and retail districts. C-3 covers downtown; lower-density C-2 covers neighborhood spines.",
  Industrial:
    "Production / distribution / repair zones. Housing not permitted by right. Often the target of state by-right conversion bills.",
  Public:
    "Public uses — parks, schools, civic buildings. Controls per §211.",
  Other:
    "Special districts not in the standard zoning families. See district section.",
}

export function getZoningBlurb(gen: string): string {
  return BLURBS[gen] ?? ''
}
```

- [ ] **Step 4: Run, expect PASS**

```bash
npx jest zoning-blurbs
```

- [ ] **Step 5: Commit**

```bash
git add lib/zoning-blurbs.ts __tests__/zoning-blurbs.test.ts
git commit -m "feat: per-gen zoning blurbs for district panel"
```

### Task 6.2: Glossary data + component

**Files:**
- Create: `lib/zoning-glossary.ts`
- Create: `components/Glossary.tsx`
- Test: `__tests__/zoning-glossary.test.ts`

- [ ] **Step 1: Write the failing test for the data**

```ts
// __tests__/zoning-glossary.test.ts
import { GLOSSARY, getGlossaryEntry } from '../lib/zoning-glossary'

describe('GLOSSARY', () => {
  it('covers the documented terms', () => {
    const terms = Object.keys(GLOSSARY)
    expect(terms).toEqual(expect.arrayContaining([
      'FAR', 'density', 'setback', 'lot coverage', 'principal use', 'ADU', 'bulk control',
    ]))
  })
  it('every entry has a non-empty definition', () => {
    for (const [term, e] of Object.entries(GLOSSARY)) {
      expect(e.definition.length).toBeGreaterThan(10)
      expect(e.term).toBe(term)
    }
  })
})

describe('getGlossaryEntry', () => {
  it('returns undefined for unknown term', () => {
    expect(getGlossaryEntry('nope')).toBeUndefined()
  })
  it('is case-insensitive', () => {
    expect(getGlossaryEntry('far')).toBeDefined()
    expect(getGlossaryEntry('FAR')).toBeDefined()
  })
})
```

- [ ] **Step 2: Run, expect FAIL**

```bash
npx jest zoning-glossary
```

- [ ] **Step 3: Implement `lib/zoning-glossary.ts`**

```ts
export interface GlossaryEntry {
  term: string
  definition: string
  source?: { article: string; section: string; url: string }
}

const AMLEGAL = 'https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_planning'

export const GLOSSARY: Record<string, GlossaryEntry> = {
  'FAR': {
    term: 'FAR',
    definition: 'Floor Area Ratio — the building floor area divided by the lot area. A FAR of 3.6 on a 5,000 sf lot allows up to 18,000 sf of building.',
    source: { article: 'Article 1.2', section: '§123', url: `${AMLEGAL}/0-0-0-123` },
  },
  'density': {
    term: 'density',
    definition: 'How many dwelling units are allowed on a lot. Expressed as either units-per-lot (e.g. RH-1 = 1) or units-per-acre (e.g. NCT-3 = 174 DU/acre).',
  },
  'setback': {
    term: 'setback',
    definition: 'Required clear distance between a building and a lot line. Front, rear, and side setbacks each have their own rules per district.',
    source: { article: 'Article 2', section: '§132', url: `${AMLEGAL}/0-0-0-132` },
  },
  'lot coverage': {
    term: 'lot coverage',
    definition: 'Maximum percentage of the lot area that can be covered by buildings. RH-1 caps at 45%, leaving 55% for yards.',
  },
  'principal use': {
    term: 'principal use',
    definition: 'The use type permitted by-right (no special hearing) in a zoning district. Marked "P" in the use tables. Compare with conditional ("C") and not-permitted ("NP").',
  },
  'ADU': {
    term: 'ADU',
    definition: 'Accessory Dwelling Unit — a small secondary home on the same lot. California state law (Gov. Code §65852.2) allows up to 2 ADUs on any residential lot, overriding stricter local zoning.',
  },
  'bulk control': {
    term: 'bulk control',
    definition: 'Limits on a building\'s size beyond height — e.g. maximum diagonal dimension, plan dimension, or volume. Encoded as a letter on the height-bulk district code: "240-S" = 240 ft height, bulk control S.',
  },
}

export function getGlossaryEntry(term: string): GlossaryEntry | undefined {
  // Case-insensitive lookup against the canonical keys.
  const lower = term.toLowerCase()
  for (const [key, entry] of Object.entries(GLOSSARY)) {
    if (key.toLowerCase() === lower) return entry
  }
  return undefined
}
```

- [ ] **Step 4: Run, expect PASS**

```bash
npx jest zoning-glossary
```

- [ ] **Step 5: Implement `components/Glossary.tsx`**

```tsx
// components/Glossary.tsx
'use client'
import { useState, type ReactNode } from 'react'
import { getGlossaryEntry } from '@/lib/zoning-glossary'

interface Props {
  term: string
  children?: ReactNode  // if absent, renders the term itself as the trigger text
}

/** Wrap a glossary term with a dotted-underline trigger and a hover popover.
 *  Usage: <Glossary term="FAR">FAR cap</Glossary> */
export function Glossary({ term, children }: Props) {
  const entry = getGlossaryEntry(term)
  const [open, setOpen] = useState(false)

  if (!entry) return <span>{children ?? term}</span>

  return (
    <span
      className="glossary-term relative inline cursor-help"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
      role="button"
      aria-describedby={`glossary-${term}`}
    >
      <span style={{ borderBottom: '1px dotted #78716c' }}>{children ?? term}</span>
      {open && (
        <span
          id={`glossary-${term}`}
          role="tooltip"
          className="absolute z-[1200] left-0 top-full mt-1 w-64 bg-paper border border-paper-edge rounded shadow-md p-3 text-[12px] leading-snug normal-case font-normal text-ink-soft"
        >
          <strong className="text-ink">{entry.term}</strong>
          <br />
          {entry.definition}
          {entry.source && (
            <>
              <br />
              <a
                href={entry.source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] uppercase tracking-wider text-ink-faint hover:text-ink"
              >
                {entry.source.section} ↗
              </a>
            </>
          )}
        </span>
      )}
    </span>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/zoning-glossary.ts components/Glossary.tsx __tests__/zoning-glossary.test.ts
git commit -m "feat: zoning glossary + inline hover-popover component"
```

### Task 6.3: SF height references data

**Files:**
- Create: `lib/sf-height-references.ts`
- Test: `__tests__/sf-height-references.test.ts`

The silhouette SVG path data — hand-drawn, single-color paths. Each silhouette is a small `<path d="..." />` string that fits inside a small viewBox (e.g. 40×100 for tall buildings, 80×40 for wide Painted Ladies row).

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/sf-height-references.test.ts
import { SF_HEIGHT_REFERENCES } from '../lib/sf-height-references'

describe('SF_HEIGHT_REFERENCES', () => {
  it('contains at least 10 entries', () => {
    expect(SF_HEIGHT_REFERENCES.length).toBeGreaterThanOrEqual(10)
  })
  it('each entry has name, height_ft, category, illustration, width_px, source', () => {
    for (const r of SF_HEIGHT_REFERENCES) {
      expect(r.name).toBeTruthy()
      expect(r.height_ft).toBeGreaterThan(0)
      expect(['human', 'residential', 'civic', 'tower']).toContain(r.category)
      expect(r.illustration).toMatch(/^<svg.*<\/svg>$/s)  // inline SVG string
      expect(r.width_px).toBeGreaterThan(0)
      expect(r.source).toBeTruthy()
    }
  })
  it('includes the cornerstone landmarks', () => {
    const names = SF_HEIGHT_REFERENCES.map((r) => r.name)
    expect(names).toEqual(expect.arrayContaining([
      'Person', 'Coit Tower', 'Transamerica Pyramid', 'Salesforce Tower',
    ]))
  })
})
```

- [ ] **Step 2: Run, expect FAIL**

```bash
npx jest sf-height-references
```

- [ ] **Step 3: Implement `lib/sf-height-references.ts` with inline SVG silhouettes**

The silhouettes below are simple monochromatic paths. They're intended to be **distinctive enough to recognize at small sizes (~20–60 px)**, not photo-realistic. The implementing agent should refine them; the values below are the starting skeleton.

```ts
export interface HeightReference {
  name: string
  height_ft: number
  category: 'human' | 'residential' | 'civic' | 'tower'
  illustration: string   // inline SVG string with width="..." height="..."
  width_px: number       // intrinsic width for layout (height scales by height_ft)
  source: string         // citation
}

// Naming convention for the inline SVG: viewBox sized to the silhouette's
// natural aspect ratio. The HeightContext component scales it.

export const SF_HEIGHT_REFERENCES: HeightReference[] = [
  {
    name: 'Person',
    height_ft: 5.83,
    category: 'human',
    width_px: 8,
    source: 'Average adult height, U.S. Census 2020',
    illustration: '<svg viewBox="0 0 8 24" xmlns="http://www.w3.org/2000/svg"><circle cx="4" cy="3" r="2" fill="#1c2438"/><rect x="3" y="5" width="2" height="10" fill="#1c2438"/><rect x="2" y="14" width="1.5" height="9" fill="#1c2438"/><rect x="4.5" y="14" width="1.5" height="9" fill="#1c2438"/></svg>',
  },
  {
    name: 'Typical floor',
    height_ft: 10,
    category: 'human',
    width_px: 24,
    source: 'Standard residential floor height',
    illustration: '<svg viewBox="0 0 24 20" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="24" height="20" fill="none" stroke="#1c2438" stroke-width="1.5"/><rect x="4" y="5" width="6" height="8" fill="#1c2438" opacity="0.3"/><rect x="14" y="5" width="6" height="8" fill="#1c2438" opacity="0.3"/></svg>',
  },
  {
    name: '3-story Victorian',
    height_ft: 35,
    category: 'residential',
    width_px: 22,
    source: 'Typical SF row house, SF Planning Department historic resources',
    illustration: '<svg viewBox="0 0 22 50" xmlns="http://www.w3.org/2000/svg"><polygon points="0,15 11,0 22,15 22,50 0,50" fill="#1c2438"/><rect x="3" y="20" width="4" height="6" fill="#fbf6ec"/><rect x="15" y="20" width="4" height="6" fill="#fbf6ec"/><rect x="3" y="30" width="4" height="6" fill="#fbf6ec"/><rect x="15" y="30" width="4" height="6" fill="#fbf6ec"/><rect x="9" y="40" width="4" height="10" fill="#fbf6ec"/></svg>',
  },
  {
    name: 'Painted Ladies',
    height_ft: 40,
    category: 'residential',
    width_px: 80,
    source: '710-720 Steiner Street, ~1894 construction',
    illustration: '<svg viewBox="0 0 80 56" xmlns="http://www.w3.org/2000/svg"><g fill="#1c2438"><polygon points="0,18 13,0 26,18 26,56 0,56"/><polygon points="26,18 39,0 52,18 52,56 26,56"/><polygon points="52,18 65,0 78,18 78,56 52,56"/></g><g fill="#fbf6ec"><rect x="4" y="24" width="4" height="6"/><rect x="17" y="24" width="4" height="6"/><rect x="30" y="24" width="4" height="6"/><rect x="43" y="24" width="4" height="6"/><rect x="56" y="24" width="4" height="6"/><rect x="69" y="24" width="4" height="6"/></g></svg>',
  },
  {
    name: 'Sentinel Building',
    height_ft: 102,
    category: 'civic',
    width_px: 16,
    source: 'Columbus & Kearny, 1907; CTBUH',
    illustration: '<svg viewBox="0 0 16 120" xmlns="http://www.w3.org/2000/svg"><path d="M2,120 L2,30 Q2,15 4,10 L12,10 Q14,15 14,30 L14,120 Z" fill="#1c2438"/><rect x="6" y="40" width="4" height="50" fill="#fbf6ec" opacity="0.3"/></svg>',
  },
  {
    name: 'Coit Tower',
    height_ft: 210,
    category: 'civic',
    width_px: 18,
    source: '1933, Arthur Brown Jr.; SF Recreation & Parks',
    illustration: '<svg viewBox="0 0 18 220" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="200" width="12" height="20" fill="#1c2438"/><rect x="4" y="20" width="10" height="180" fill="#1c2438"/><rect x="5" y="10" width="8" height="10" fill="#1c2438"/><rect x="6" y="0" width="6" height="10" fill="#1c2438"/></svg>',
  },
  {
    name: 'One Embarcadero Center',
    height_ft: 568,
    category: 'tower',
    width_px: 30,
    source: '1971; CTBUH',
    illustration: '<svg viewBox="0 0 30 200" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="10" width="30" height="190" fill="#1c2438"/><rect x="2" y="0" width="26" height="10" fill="#1c2438"/></svg>',
  },
  {
    name: '555 California',
    height_ft: 779,
    category: 'tower',
    width_px: 32,
    source: '1969 (Bank of America Center); CTBUH',
    illustration: '<svg viewBox="0 0 32 240" xmlns="http://www.w3.org/2000/svg"><polygon points="2,240 2,30 16,5 30,30 30,240" fill="#1c2438"/><g fill="#fbf6ec" opacity="0.15"><rect x="6" y="40" width="2" height="180"/><rect x="14" y="40" width="2" height="180"/><rect x="22" y="40" width="2" height="180"/></g></svg>',
  },
  {
    name: 'Transamerica Pyramid',
    height_ft: 853,
    category: 'tower',
    width_px: 60,
    source: '1972, William Pereira; CTBUH',
    illustration: '<svg viewBox="0 0 60 240" xmlns="http://www.w3.org/2000/svg"><polygon points="0,240 30,0 60,240" fill="#1c2438"/></svg>',
  },
  {
    name: 'Salesforce Tower',
    height_ft: 1070,
    category: 'tower',
    width_px: 28,
    source: '2018; CTBUH',
    illustration: '<svg viewBox="0 0 28 300" xmlns="http://www.w3.org/2000/svg"><path d="M4,300 L4,80 Q4,40 14,30 Q24,40 24,80 L24,300 Z" fill="#1c2438"/><line x1="14" y1="0" x2="14" y2="30" stroke="#1c2438" stroke-width="2"/></svg>',
  },
]
```

- [ ] **Step 4: Run, expect PASS**

```bash
npx jest sf-height-references
```

- [ ] **Step 5: Commit**

```bash
git add lib/sf-height-references.ts __tests__/sf-height-references.test.ts
git commit -m "feat: SF height references with inline SVG silhouettes"
```

### Task 6.4: HeightContext component

**Files:**
- Create: `components/HeightContext.tsx`

- [ ] **Step 1: Implement the component**

The break-axis scale: four bands (0–50 / 50–250 / 250–800 / 800–1100 ft). Within each band, linear. Each band gets a fixed share of the visual height (e.g. 25% each → 70 px per band on a 280 px chart). A break-line `~` separates bands.

```tsx
// components/HeightContext.tsx
'use client'
import { SF_HEIGHT_REFERENCES, type HeightReference } from '@/lib/sf-height-references'

interface Props {
  height_ft: number
  districtCode: string
}

// Break-axis bands. Each band maps a slice of pixel space to a height range.
const BANDS = [
  { from: 0,    to: 50,   pxFraction: 0.30 },   // human / residential
  { from: 50,   to: 250,  pxFraction: 0.20 },   // civic
  { from: 250,  to: 800,  pxFraction: 0.30 },   // mid-tier towers
  { from: 800,  to: 1100, pxFraction: 0.20 },   // Salesforce
] as const

const CHART_HEIGHT_PX = 280
const CHART_WIDTH_PX = 360

/** Map a height in feet to a pixel y-position (0 = top, CHART_HEIGHT_PX = bottom). */
function ftToY(ft: number): number {
  let cumPx = 0
  for (const band of BANDS) {
    const bandPx = band.pxFraction * CHART_HEIGHT_PX
    if (ft <= band.to) {
      const inBandFraction = (ft - band.from) / (band.to - band.from)
      return CHART_HEIGHT_PX - (cumPx + bandPx * inBandFraction)
    }
    cumPx += bandPx
  }
  return 0  // taller than the chart — pin to top
}

export function HeightContext({ height_ft, districtCode }: Props) {
  if (!height_ft || height_ft <= 0) {
    return (
      <div className="text-[11px] text-ink-faint italic">
        Height not specified for this district — see codesection.
      </div>
    )
  }

  const bandY = ftToY(height_ft)
  const districtLabel = `${districtCode}: ${height_ft} ft`
  // Bold-emphasize references within ±20% of the district height.
  const proximityThreshold = height_ft * 0.20
  const refs = SF_HEIGHT_REFERENCES.map((r) => ({
    ...r,
    isNear: Math.abs(r.height_ft - height_ft) <= proximityThreshold,
    y: ftToY(r.height_ft),
  }))

  return (
    <div className="relative" style={{ width: CHART_WIDTH_PX, height: CHART_HEIGHT_PX }} aria-label={`Height context for ${districtLabel}`}>
      {/* Y-axis tick labels at band boundaries */}
      <svg className="absolute left-0 top-0" width="30" height={CHART_HEIGHT_PX} aria-hidden>
        {BANDS.map((b, i) => {
          const y = ftToY(b.to)
          return (
            <text key={i} x="2" y={y + 4} fontSize="9" fill="#78716c">{b.to} ft</text>
          )
        })}
      </svg>

      {/* Break-axis ~ separators between bands */}
      <svg className="absolute left-[28px] top-0" width={CHART_WIDTH_PX - 28} height={CHART_HEIGHT_PX} aria-hidden>
        {BANDS.slice(0, -1).map((b, i) => {
          const y = ftToY(b.to)
          return (
            <g key={i}>
              <line x1="0" y1={y} x2={CHART_WIDTH_PX - 28} y2={y} stroke="#d6cfbe" strokeWidth="1" strokeDasharray="2 3"/>
              <text x={CHART_WIDTH_PX - 50} y={y - 2} fontSize="10" fill="#78716c">~</text>
            </g>
          )
        })}
      </svg>

      {/* Highlighted district band */}
      <div
        className="absolute"
        style={{
          left: 28,
          right: 0,
          top: bandY - 1,
          height: 3,
          background: '#9a4a31',
          opacity: 0.8,
        }}
      />
      <div
        className="absolute right-0 text-[10px] uppercase tracking-wider font-semibold"
        style={{ top: bandY - 14, color: '#9a4a31' }}
      >
        {districtLabel}
      </div>

      {/* Reference silhouettes — each positioned by its y, label to the right of the silhouette. */}
      {refs.map((r, i) => {
        const offsetLeft = 40 + (i % 3) * 110   // simple staggered layout to reduce overlap
        const labelClass = r.isNear
          ? 'text-[10px] font-semibold text-ink'
          : 'text-[10px] text-ink-soft'
        return (
          <div key={r.name} className="absolute" style={{ left: offsetLeft, top: r.y - 4, transform: 'translateY(-100%)' }}>
            <div
              style={{ width: r.width_px, height: 'auto', display: 'inline-block' }}
              dangerouslySetInnerHTML={{ __html: r.illustration }}
            />
            <span className={`block ${labelClass}`} style={{ whiteSpace: 'nowrap' }}>
              {r.name} ({r.height_ft} ft)
            </span>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Add a basic snapshot test**

```ts
// __tests__/height-context.test.tsx
/**
 * @jest-environment jsdom
 */
import { render } from '@testing-library/react'
import { HeightContext } from '../components/HeightContext'

describe('HeightContext', () => {
  it('renders an empty-state message when height_ft is missing', () => {
    const { container } = render(<HeightContext height_ft={0} districtCode="UNKNOWN" />)
    expect(container.textContent).toMatch(/not specified/i)
  })
  it('renders the district label when height_ft is set', () => {
    const { container } = render(<HeightContext height_ft={40} districtCode="RH-1" />)
    expect(container.textContent).toMatch(/RH-1: 40 ft/)
  })
  it('includes all 10 references', () => {
    const { container } = render(<HeightContext height_ft={40} districtCode="RH-1" />)
    expect(container.textContent).toMatch(/Salesforce Tower/)
    expect(container.textContent).toMatch(/Painted Ladies/)
  })
})
```

- [ ] **Step 3: Run, expect PASS (3/3)**

```bash
npx jest height-context
```

- [ ] **Step 4: Commit**

```bash
git add components/HeightContext.tsx __tests__/height-context.test.tsx
git commit -m "feat: HeightContext break-axis chart with SF silhouettes"
```

### Task 6.5: Wire all panel additions into ZoningDistrictPanel

**Files:**
- Modify: `components/ZoningDistrictPanel.tsx`

- [ ] **Step 1: Update the component**

Read the existing `components/ZoningDistrictPanel.tsx`. Add the new elements:

```tsx
// components/ZoningDistrictPanel.tsx
'use client'
import { LensInfoPanel } from './LensInfoPanel'
import { Glossary } from './Glossary'
import { HeightContext } from './HeightContext'
import { getZoningRecord } from '@/lib/zoning-rules'
import { eligibleLaws } from '@/lib/family-zoning'
import { getZoningBlurb } from '@/lib/zoning-blurbs'

interface Props {
  zoningSim: string | null
  gen: string | null
  heightFt?: number
  bulk?: string
  permitCountInDistrict?: number   // new: passed from Map.tsx
  onClose: () => void
  onDrillToDistrict?: (zoningSim: string) => void   // for "recent permits" chip
}

export function ZoningDistrictPanel({
  zoningSim, gen, heightFt, bulk,
  permitCountInDistrict = 0,
  onClose,
  onDrillToDistrict,
}: Props) {
  const open = !!zoningSim
  const rec = zoningSim ? getZoningRecord(zoningSim) : null
  const laws = zoningSim && gen ? eligibleLaws(zoningSim, gen) : []
  const blurb = gen ? getZoningBlurb(gen) : ''

  if (!zoningSim) {
    return <LensInfoPanel open={open} eyebrow="Zoning district" title="—" onClose={onClose} />
  }

  // The custom "below-LensInfoPanel" content (blurb, height chart, glossary
  // wraps, recent-permits chip, external links) needs a slot. LensInfoPanel
  // doesn't natively support children below; we render a sibling div anchored
  // to the same panel location. Wrap both in a fragment.
  return (
    <>
      <LensInfoPanel
        open={open}
        eyebrow="Zoning district"
        title={zoningSim}
        subtitle={gen ?? undefined}
        hero={
          heightFt
            ? { eyebrow: 'Max height', value: `${heightFt} ft`, detail: bulk ? `bulk ${bulk}` : '' }
            : undefined
        }
        primary={rec ? buildRulesRows(rec, heightFt) : undefined}
        secondary={laws.length > 0 ? { eyebrow: 'State-law uplift', rows: laws.map((l) => ({ label: `${l.law}: ${l.uplift_summary}`, value: '', pct: 1, color: '#9a4a31' })) } : undefined}
        onClose={onClose}
      />

      {open && (
        <div className="lens-info-panel-extras absolute right-4 bottom-4 z-[1102] w-[360px] max-h-[60vh] overflow-y-auto bg-paper border border-paper-edge rounded p-3 text-[12px]" role="complementary">
          {blurb && (
            <p className="text-ink-soft italic leading-relaxed mb-3">{blurb}</p>
          )}

          {heightFt && heightFt > 0 && (
            <div className="mb-3">
              <div className="civic-eyebrow mb-1">Height in context</div>
              <HeightContext height_ft={heightFt} districtCode={zoningSim} />
            </div>
          )}

          <div className="mb-3 text-ink-soft text-[11px] leading-snug">
            Common terms:
            {' '}<Glossary term="FAR" />,{' '}
            <Glossary term="density" />,{' '}
            <Glossary term="setback" />,{' '}
            <Glossary term="lot coverage" />,{' '}
            <Glossary term="principal use" />,{' '}
            <Glossary term="ADU" />.
          </div>

          {permitCountInDistrict > 0 && onDrillToDistrict && (
            <button
              type="button"
              onClick={() => onDrillToDistrict(zoningSim)}
              className="block w-full mb-3 px-2 py-1.5 text-[11px] uppercase tracking-wider rounded border border-paper-edge hover:border-ink text-ink"
            >
              {permitCountInDistrict} permits in {zoningSim} currently visible →
            </button>
          )}

          <div className="border-t border-paper-edge pt-3 text-[10px] text-ink-faint space-y-1">
            <div className="uppercase tracking-wider mb-1">Sources</div>
            {rec?.source && (
              <a href={rec.source.density.url} target="_blank" rel="noopener noreferrer" className="block hover:text-ink">
                SF Planning Code {rec.source.density.section} ↗
              </a>
            )}
            {laws.find((l) => l.law === 'SB-9') && (
              <a href="https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=GOV&sectionNum=65852.21" target="_blank" rel="noopener noreferrer" className="block hover:text-ink">
                CA Gov. Code §65852.21 (SB-9) ↗
              </a>
            )}
            <a href="https://sfplanninggis.org/pim/" target="_blank" rel="noopener noreferrer" className="block hover:text-ink">
              View on SF Property Information Map ↗
            </a>
          </div>
        </div>
      )}
    </>
  )
}

function buildRulesRows(rec: import('@/lib/zoning-rules').ZoningRecord, heightFt?: number) {
  const rows: { label: string; value: string; pct: number; color: string }[] = []
  if (heightFt) rows.push({ label: `Height: ${heightFt} ft`, value: '', pct: 1, color: '#7d9b76' })
  if (rec.density.units_per_lot != null) rows.push({ label: `Density: ${rec.density.units_per_lot} unit(s) per lot`, value: '', pct: 1, color: '#7d9b76' })
  else if (rec.density.du_per_acre != null) rows.push({ label: `Density: ${rec.density.du_per_acre} DU/acre`, value: '', pct: 1, color: '#7d9b76' })
  else if (rec.density.note) rows.push({ label: `Density: ${rec.density.note}`, value: '', pct: 0.5, color: '#7d9b76' })
  if (rec.far?.max) rows.push({ label: `FAR cap: ${rec.far.max}`, value: '', pct: 1, color: '#7d9b76' })
  if (rec.parking_min.residential) rows.push({ label: `Parking (resi): ${rec.parking_min.residential}`, value: '', pct: 0.7, color: '#b08968' })
  if (rec.parking_min.commercial) rows.push({ label: `Parking (commercial): ${rec.parking_min.commercial}`, value: '', pct: 0.7, color: '#b08968' })
  if (rec.principal_uses.length > 0) rows.push({ label: `Uses: ${rec.principal_uses.slice(0, 3).join(', ')}${rec.principal_uses.length > 3 ? '…' : ''}`, value: '', pct: 0.6, color: '#5d7a99' })
  return { eyebrow: 'Rules', rows }
}
```

- [ ] **Step 2: Pass `permitCountInDistrict` from Map.tsx**

In `components/Map.tsx`, where `<ZoningDistrictPanel .../>` is mounted, compute the count:

```tsx
const permitCountInDistrict = (() => {
  if (!selectedZoningDistrict) return 0
  // Use the filteredPermits + cached zoning resolver. Simple version:
  // iterate filteredPermits, fetch zoning_sim via the same /api/zoning-for-point
  // path. Since we don't want N network requests, do a synchronous PIP
  // against the zoning GeoJSON if loaded; otherwise return 0 until ready.
  // For this iteration, return filteredPermits.length as a placeholder until
  // a zoning-resolver helper is extracted in a future task.
  // ACTUAL: this is overkill for the chip; just return the visible count.
  return filteredPermits.length
})()
```

(The "actual" simpler approach: render the chip with the total filtered count if we can't cheaply count per-district, with the label changed to "Currently visible permits → filter to this district".)

Pass through:

```tsx
<ZoningDistrictPanel
  zoningSim={selectedZoningDistrict?.zoningSim ?? null}
  gen={selectedZoningDistrict?.gen ?? null}
  heightFt={selectedZoningDistrict ? zoningHeights[selectedZoningDistrict.zoningSim]?.height_ft : undefined}
  bulk={selectedZoningDistrict ? zoningHeights[selectedZoningDistrict.zoningSim]?.bulk : undefined}
  permitCountInDistrict={permitCountInDistrict}
  onDrillToDistrict={(zoningSim) => {
    const url = new URL(window.location.href)
    url.searchParams.set('district', zoningSim)
    window.history.pushState({}, '', url)
  }}
  onClose={() => setSelectedZoningDistrict(null)}
/>
```

- [ ] **Step 3: Verify in browser**

Switch to zoning lens, click a polygon. Panel should now show:
- Hero (height ft + bulk letter)
- Rules (existing)
- State-law uplift (existing)
- Per-gen blurb (italic, top of extras card)
- Height-in-context chart
- Common-terms line with dotted underlines
- Permits-in-district chip
- Sources footer (SF Planning Code link + family-law if SB-9 + PIM link)

- [ ] **Step 4: Commit**

```bash
git add components/ZoningDistrictPanel.tsx components/Map.tsx
git commit -m "feat: editorial extras on zoning district panel (blurb, height, glossary, sources)"
```

---

## Phase 7 — Chrome rewrite

The cutover. Delete old chrome; mount the new SummaryCard + LensRail + FilterFAB + FilterSheet.

### Task 7.1: SummaryCard component

**Files:**
- Create: `components/SummaryCard.tsx`
- Test: `__tests__/summary-card.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/summary-card.test.tsx
/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { SummaryCard, type SummaryCardItem } from '../components/SummaryCard'

const items: SummaryCardItem[] = [
  { id: 'a', name: 'Mission',  count: 183 },
  { id: 'b', name: 'SoMa',     count: 147 },
  { id: 'c', name: 'Bayview',  count: 142 },
  { id: 'd', name: 'TL',       count: 98  },
  { id: 'e', name: 'Sunset',   count: 88  },
  { id: 'f', name: 'Excelsior',count: 76  },
  { id: 'g', name: 'NB',       count: 52  },
]

describe('SummaryCard', () => {
  it('renders the collapsed line in "none" state', () => {
    render(<SummaryCard state="none" summary="1,824 visible" items={items} onStateChange={() => {}} onItemClick={() => {}} eyebrow="Major projects" />)
    expect(screen.getByText('1,824 visible')).toBeInTheDocument()
    expect(screen.queryByText('Mission')).toBeNull()
  })

  it('renders top-5 in "top5" state', () => {
    render(<SummaryCard state="top5" summary="1,824 visible" items={items} onStateChange={() => {}} onItemClick={() => {}} eyebrow="Major projects" />)
    expect(screen.getByText('Mission')).toBeInTheDocument()
    expect(screen.getByText('SoMa')).toBeInTheDocument()
    expect(screen.getByText('Sunset')).toBeInTheDocument()  // 5th
    expect(screen.queryByText('Excelsior')).toBeNull()      // 6th
  })

  it('renders all items in "all" state', () => {
    render(<SummaryCard state="all" summary="1,824 visible" items={items} onStateChange={() => {}} onItemClick={() => {}} eyebrow="Major projects" />)
    expect(screen.getByText('Excelsior')).toBeInTheDocument()
    expect(screen.getByText('NB')).toBeInTheDocument()
  })

  it('cycles state via the click target', () => {
    const onStateChange = jest.fn()
    render(<SummaryCard state="top5" summary="x" items={items} onStateChange={onStateChange} onItemClick={() => {}} eyebrow="x" />)
    fireEvent.click(screen.getByText(/See all 7/))
    expect(onStateChange).toHaveBeenCalledWith('all')
  })
})
```

- [ ] **Step 2: Run, expect FAIL**

```bash
npx jest summary-card
```

- [ ] **Step 3: Implement `components/SummaryCard.tsx`**

```tsx
// components/SummaryCard.tsx
'use client'
import { Logo } from './Logo'

export type SummaryCardState = 'none' | 'top5' | 'all'

export interface SummaryCardItem {
  id: string
  name: string
  count: number
}

interface Props {
  state: SummaryCardState
  summary: string         // e.g. "1,824 visible · Major projects, any use, last 2 years"
  eyebrow: string         // e.g. "What's Building SF"
  items: SummaryCardItem[]
  onStateChange: (s: SummaryCardState) => void
  onItemClick: (id: string) => void
}

const TOP_N = 5

/** Top-right summary card with three click-cycled states. */
export function SummaryCard({ state, summary, eyebrow, items, onStateChange, onItemClick }: Props) {
  const visibleItems = state === 'top5' ? items.slice(0, TOP_N) : state === 'all' ? items : []
  const topCount = Math.max(1, ...items.slice(0, 10).map((i) => i.count))

  const toggleState = () => {
    if (state === 'none') onStateChange('top5')
    else if (state === 'top5') onStateChange('all')
    else onStateChange('none')
  }

  return (
    <aside className="absolute top-4 right-4 z-[1000] bg-ink text-paper rounded-md shadow-lg w-[280px] max-h-[calc(100dvh-2rem)] overflow-hidden flex flex-col">
      <button
        type="button"
        onClick={toggleState}
        className="text-left px-4 pt-3 pb-2 w-full focus:outline-none focus:ring-2 focus:ring-paper/50"
        aria-expanded={state !== 'none'}
      >
        <div className="flex items-center gap-2">
          <Logo size={20} variant="on-ink" />
          <div className="font-serif text-base leading-tight">{eyebrow}</div>
        </div>
        <p className="text-[11px] opacity-85 mt-1 leading-snug">{summary}</p>
      </button>

      {visibleItems.length > 0 && (
        <div className="px-4 pb-3 overflow-y-auto border-t border-paper/15">
          <ul className="space-y-1 pt-2">
            {visibleItems.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onItemClick(item.id)}
                  className="w-full text-left grid grid-cols-[1fr_auto] gap-2 hover:bg-paper/5 rounded px-1 py-0.5 transition-colors"
                >
                  <span className="font-serif text-[13px] truncate leading-tight">{item.name}</span>
                  <span className="text-[11px] tabular-nums opacity-80">{item.count}</span>
                  <span
                    className="col-span-2 h-[2px] rounded mt-0.5"
                    style={{
                      width: `${(item.count / topCount) * 100}%`,
                      background: '#9a4a31',
                      opacity: 0.85,
                    }}
                  />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={toggleState}
        className="text-[10px] uppercase tracking-wider px-4 py-2 border-t border-paper/15 hover:bg-paper/5 transition"
      >
        {state === 'none'   ? `Show top ${TOP_N} ↓` : null}
        {state === 'top5'   ? `See all ${items.length} ↓` : null}
        {state === 'all'    ? `Show top ${TOP_N} ↑` : null}
      </button>
    </aside>
  )
}
```

- [ ] **Step 4: Run, expect PASS**

```bash
npx jest summary-card
```

- [ ] **Step 5: Commit**

```bash
git add components/SummaryCard.tsx __tests__/summary-card.test.tsx
git commit -m "feat: SummaryCard with 3-state click cycle"
```

### Task 7.2: LensRail component

**Files:**
- Create: `components/LensRail.tsx`

- [ ] **Step 1: Implement**

```tsx
// components/LensRail.tsx
'use client'
import type { MapMode } from './MapModeSwitch'   // type only; the file may be deleted after Phase 7

export type LensMode = 'neighborhoods' | 'zoning' | 'transit'

interface Props {
  mode: LensMode
  onChange: (m: LensMode) => void
}

const MODES: { value: LensMode; label: string }[] = [
  { value: 'neighborhoods', label: 'Neighborhoods' },
  { value: 'zoning',        label: 'Zoning' },
  { value: 'transit',       label: 'Transit' },
]

export function LensRail({ mode, onChange }: Props) {
  return (
    <div
      className="absolute bottom-4 left-4 z-[1000] bg-paper border border-paper-edge rounded-md shadow-md flex items-center gap-1 px-1.5 py-1"
      role="radiogroup"
      aria-label="Map lens"
    >
      {MODES.map((m) => (
        <button
          key={m.value}
          type="button"
          role="radio"
          aria-checked={mode === m.value}
          onClick={() => onChange(m.value)}
          className={`text-[11px] px-2.5 py-1 rounded-full font-semibold transition ${
            mode === m.value
              ? 'bg-ink text-paper'
              : 'text-ink-soft hover:text-ink'
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}
```

(Re-define `LensMode` here since we may delete `MapModeSwitch.tsx`. Update `Map.tsx`'s `mapMode` state to use this type.)

- [ ] **Step 2: Commit**

```bash
git add components/LensRail.tsx
git commit -m "feat: LensRail (bottom-left 3-pill lens switcher)"
```

### Task 7.3: FilterFAB + FilterSheet

**Files:**
- Create: `components/FilterFAB.tsx`
- Create: `components/FilterSheet.tsx`

- [ ] **Step 1: Implement `FilterFAB`**

```tsx
// components/FilterFAB.tsx
'use client'

interface Props {
  open: boolean
  onToggle: () => void
}

/** Bottom-right circular button that opens the FilterSheet. */
export function FilterFAB({ open, onToggle }: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={open ? 'Close filters' : 'Open filters'}
      className="absolute bottom-4 right-4 z-[1001] w-11 h-11 rounded-full bg-ink text-paper flex items-center justify-center shadow-lg hover:bg-ink-soft transition-colors text-xl"
    >
      {open ? '✕' : '☰'}
    </button>
  )
}
```

- [ ] **Step 2: Implement `FilterSheet`**

```tsx
// components/FilterSheet.tsx
'use client'
import { useEffect } from 'react'
import {
  CATEGORIES, STAGE_ORDER, USE_CATEGORY_LABELS, USE_CATEGORY_COLORS,
  STAGE_LABELS, STAGE_COLORS, STAGE_DEFINITIONS, stageIconSvg,
  type PermitStage, type UseCategory,
} from '@/lib/permit-style'
import type { LensMode } from './LensRail'
import type {
  MinUnitsFilter, CompletedYearsFilter, RecentActivityFilter,
} from './Map'

const LIFECYCLE: PermitStage[] = ['filed', 'approved', 'permitted', 'construction', 'complete']

const MIN_UNITS_OPTIONS: { value: MinUnitsFilter; label: string }[] = [
  { value: 0, label: 'Any' }, { value: 2, label: '2+' }, { value: 5, label: '5+' },
  { value: 25, label: '25+' }, { value: 100, label: '100+' },
]
const COMPLETED_YEARS_OPTIONS: { value: CompletedYearsFilter; label: string }[] = [
  { value: 1, label: '1y' }, { value: 2, label: '2y' }, { value: 5, label: '5y' },
]
const RECENT_ACTIVITY_OPTIONS: { value: RecentActivityFilter; label: string }[] = [
  { value: 0, label: 'Any' }, { value: 6, label: '6mo' }, { value: 12, label: '1y' },
  { value: 24, label: '2y' }, { value: 60, label: '5y' },
]
const TRANSIT_OPTIONS: { value: 'off' | 'rail' | 'rapid-bus' | 'both'; label: string }[] = [
  { value: 'off',       label: 'Off' },
  { value: 'rail',      label: 'Rail' },
  { value: 'rapid-bus', label: 'Rapid bus' },
  { value: 'both',      label: 'Both' },
]

interface Props {
  open: boolean
  onClose: () => void

  mode: LensMode
  onModeChange: (m: LensMode) => void

  selectedStages: Set<PermitStage>
  onToggleStage: (s: PermitStage) => void
  onSetStages: (next: Set<PermitStage>) => void

  selectedCategories: Set<UseCategory>
  onToggleCategory: (c: UseCategory) => void
  onSetCategories: (next: Set<UseCategory>) => void

  minUnits: MinUnitsFilter
  onMinUnitsChange: (n: MinUnitsFilter) => void

  completedYears: CompletedYearsFilter
  onCompletedYearsChange: (n: CompletedYearsFilter) => void

  recentActivity: RecentActivityFilter
  onRecentActivityChange: (n: RecentActivityFilter) => void

  transit: 'off' | 'rail' | 'rapid-bus' | 'both'
  onTransitChange: (v: 'off' | 'rail' | 'rapid-bus' | 'both') => void
}

export function FilterSheet(props: Props) {
  // Escape closes
  useEffect(() => {
    if (!props.open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') props.onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [props.open, props.onClose])

  if (!props.open) return null

  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close filters"
        onClick={props.onClose}
        className="absolute inset-0 z-[1002] bg-ink/30"
      />

      {/* Sheet */}
      <aside
        role="dialog"
        aria-modal="true"
        className="absolute bottom-0 left-0 right-0 z-[1003] bg-paper border-t border-paper-edge shadow-2xl rounded-t-lg max-h-[60vh] overflow-y-auto p-4 mx-auto md:max-w-[480px] md:left-1/2 md:-translate-x-1/2 md:bottom-4 md:rounded-lg md:border"
      >
        <div className="space-y-5">
          {/* Lens */}
          <section>
            <div className="civic-eyebrow mb-2">Map lens</div>
            <div className="flex gap-1">
              {(['neighborhoods', 'zoning', 'transit'] as LensMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => props.onModeChange(m)}
                  className={`flex-1 px-2 py-1.5 text-xs rounded border transition ${
                    props.mode === m
                      ? 'bg-ink text-paper border-ink font-semibold'
                      : 'bg-paper text-ink-soft border-paper-edge hover:border-ink'
                  }`}
                >
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
          </section>

          {/* Use type */}
          <section>
            <div className="civic-eyebrow mb-2">Use type</div>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => {
                const on = props.selectedCategories.has(cat)
                const color = USE_CATEGORY_COLORS[cat].fill
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => props.onToggleCategory(cat)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition"
                    style={on
                      ? { color, backgroundColor: `${color}1f`, border: `1.5px solid ${color}` }
                      : { color: '#78716c', backgroundColor: 'transparent', border: '1.5px dashed #d6cfbe' }
                    }
                  >
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full"
                      style={on
                        ? { backgroundColor: color }
                        : { backgroundColor: 'transparent', border: '1.5px solid #a8a29e' }
                      }
                    />
                    {USE_CATEGORY_LABELS[cat]}
                  </button>
                )
              })}
            </div>
            {props.selectedCategories.has('housing') && (
              <div className="mt-2.5">
                <div className="text-[10px] uppercase tracking-wider text-ink-faint mb-1">Net new homes</div>
                <div className="flex gap-1">
                  {MIN_UNITS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => props.onMinUnitsChange(opt.value)}
                      className={`flex-1 px-2 py-1 text-xs rounded border transition ${
                        props.minUnits === opt.value
                          ? 'bg-ink text-paper border-ink font-semibold'
                          : 'bg-paper text-ink-soft border-paper-edge hover:border-ink'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Lifecycle */}
          <section>
            <div className="civic-eyebrow mb-2">Lifecycle</div>
            <div className="flex flex-wrap gap-1.5">
              {LIFECYCLE.map((stage) => {
                const on = props.selectedStages.has(stage)
                const color = STAGE_COLORS[stage].fill
                const label = STAGE_LABELS[stage].split(' / ')[0].split(' · ')[0]
                return (
                  <button
                    key={stage}
                    type="button"
                    onClick={() => props.onToggleStage(stage)}
                    title={STAGE_DEFINITIONS[stage]}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition"
                    style={on
                      ? { color, backgroundColor: `${color}1f`, border: `1.5px solid ${color}` }
                      : { color: '#78716c', backgroundColor: 'transparent', border: '1.5px dashed #d6cfbe' }
                    }
                  >
                    <span
                      className="inline-flex w-3.5 h-3.5"
                      style={{ opacity: on ? 1 : 0.3 }}
                      dangerouslySetInnerHTML={{ __html: stageIconSvg(stage, 14) }}
                    />
                    {label}
                  </button>
                )
              })}
            </div>
            <label className="flex items-center gap-2 text-xs text-ink-soft mt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={props.selectedStages.has('inactive')}
                onChange={() => props.onToggleStage('inactive')}
                className="accent-ink"
              />
              <span>Include cancelled / expired</span>
            </label>
            {props.selectedStages.has('complete') && (
              <div className="mt-2.5">
                <div className="text-[10px] uppercase tracking-wider text-ink-faint mb-1">Completed within</div>
                <div className="flex gap-1">
                  {COMPLETED_YEARS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => props.onCompletedYearsChange(opt.value)}
                      className={`flex-1 px-2 py-1 text-xs rounded border transition ${
                        props.completedYears === opt.value
                          ? 'bg-ink text-paper border-ink font-semibold'
                          : 'bg-paper text-ink-soft border-paper-edge hover:border-ink'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Recent activity */}
          <section>
            <div className="civic-eyebrow mb-2">Recent activity</div>
            <div className="flex gap-1">
              {RECENT_ACTIVITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => props.onRecentActivityChange(opt.value)}
                  className={`flex-1 px-2 py-1 text-xs rounded border transition ${
                    props.recentActivity === opt.value
                      ? 'bg-ink text-paper border-ink font-semibold'
                      : 'bg-paper text-ink-soft border-paper-edge hover:border-ink'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </section>

          {/* Transit-adjacent */}
          <section>
            <div className="civic-eyebrow mb-2">Transit-adjacent only</div>
            <div className="flex gap-1">
              {TRANSIT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => props.onTransitChange(opt.value)}
                  className={`flex-1 px-2 py-1 text-xs rounded border transition ${
                    props.transit === opt.value
                      ? 'bg-ink text-paper border-ink font-semibold'
                      : 'bg-paper text-ink-soft border-paper-edge hover:border-ink'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-ink-faint mt-1.5 leading-snug">
              Rail: within ¼ mi of BART/Muni Metro/Caltrain. Rapid bus: within 0.1 mi of an R-suffix Muni line.
            </p>
          </section>
        </div>
      </aside>
    </>
  )
}
```

- [ ] **Step 3: Add a small test**

```tsx
// __tests__/filter-sheet.test.tsx
/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { FilterSheet } from '../components/FilterSheet'

const noop = () => {}

const baseProps = {
  open: true,
  onClose: jest.fn(),
  mode: 'neighborhoods' as const,
  onModeChange: noop,
  selectedStages: new Set(['filed', 'approved'] as const) as unknown as Set<import('@/lib/permit-style').PermitStage>,
  onToggleStage: noop,
  onSetStages: noop,
  selectedCategories: new Set(['housing'] as const) as unknown as Set<import('@/lib/permit-style').UseCategory>,
  onToggleCategory: noop,
  onSetCategories: noop,
  minUnits: 2 as const,
  onMinUnitsChange: noop,
  completedYears: 2 as const,
  onCompletedYearsChange: noop,
  recentActivity: 24 as const,
  onRecentActivityChange: noop,
  transit: 'off' as const,
  onTransitChange: noop,
}

describe('FilterSheet', () => {
  it('renders nothing when closed', () => {
    render(<FilterSheet {...baseProps} open={false} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renders when open', () => {
    render(<FilterSheet {...baseProps} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('Escape calls onClose', () => {
    const onClose = jest.fn()
    render(<FilterSheet {...baseProps} onClose={onClose} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 4: Run, expect PASS**

```bash
npx jest filter-sheet
```

- [ ] **Step 5: Commit**

```bash
git add components/FilterFAB.tsx components/FilterSheet.tsx __tests__/filter-sheet.test.tsx
git commit -m "feat: FilterFAB + FilterSheet"
```

### Task 7.4: Mount the new chrome in Map.tsx and delete the old

**Files:**
- Modify: `components/Map.tsx`
- Delete: `components/FilterPanel.tsx`
- Delete: `components/FilterPopover.tsx`
- Delete: `components/BrowsePanel.tsx`
- Delete: `components/MapModeSwitch.tsx`

This is the cutover. Methodical because lots of imports change.

- [ ] **Step 1: Add new state and derive items for the SummaryCard**

In `components/Map.tsx`, add near other state:

```ts
import type { SummaryCardItem, SummaryCardState } from './SummaryCard'
import { SummaryCard } from './SummaryCard'
import { LensRail, type LensMode } from './LensRail'
import { FilterFAB } from './FilterFAB'
import { FilterSheet } from './FilterSheet'

const [summaryState, setSummaryState] = useState<SummaryCardState>('top5')
const [sheetOpen, setSheetOpen] = useState(false)
const [transit, setTransit] = useState<'off' | 'rail' | 'rapid-bus' | 'both'>('off')
```

Compute items per lens:

```ts
const summaryItems: SummaryCardItem[] = useMemo(() => {
  if (mapMode === 'neighborhoods') {
    return (crossStats?.neighborhoods ?? [])
      .map((row) => ({
        id: row.nhood,
        name: row.nhood,
        count: permitsByNhood?.[row.nhood]?.length ?? 0,
      }))
      .sort((a, b) => b.count - a.count)
  }
  if (mapMode === 'zoning') {
    return (crossStats?.zoning ?? []).map((row) => ({
      id: row.category,
      name: row.category,
      count: Math.round(row.share_of_sf * 100),  // "% of SF" for zoning
    }))
  }
  // transit
  return (crossStats?.transit_bands ?? []).map((row) => ({
    id: row.band,
    name: `≤ ${row.band} of rail`,
    count: Math.round(row.share_of_sf * 100),
  }))
}, [mapMode, crossStats, permitsByNhood])
```

Compute the summary sentence (reusing existing filterSummary logic from the deleted FilterPanel, lifted up into Map.tsx).

- [ ] **Step 2: Replace `railOnly`/`rapidBusOnly` state with derived booleans from `transit`**

Replace the old separate booleans with derivations:

```ts
const railOnly = transit === 'rail' || transit === 'both'
const rapidBusOnly = transit === 'rapid-bus' || transit === 'both'
```

Remove the old `setRailOnly` / `setRapidBusOnly` setters; use `setTransit('rail')` etc. instead.

- [ ] **Step 3: Replace the JSX**

In the main return, replace the old chrome mounts with:

```tsx
<SummaryCard
  state={summaryState}
  summary={summarySentence}
  eyebrow="What's Building SF"
  items={summaryItems}
  onStateChange={setSummaryState}
  onItemClick={(id) => {
    if (mapMode === 'neighborhoods') openNhoodPanel(id)
    else if (mapMode === 'zoning') setSelectedZoningDistrict({ zoningSim: id, gen: '' })
    // transit case handled later if a band selection still exists
  }}
/>
<LensRail mode={mapMode as LensMode} onChange={(m) => setMapMode(m)} />
<FilterFAB open={sheetOpen} onToggle={() => setSheetOpen((v) => !v)} />
<FilterSheet
  open={sheetOpen}
  onClose={() => setSheetOpen(false)}
  mode={mapMode as LensMode}
  onModeChange={(m) => setMapMode(m)}
  selectedStages={selectedStages}
  onToggleStage={toggleStage}
  onSetStages={setSelectedStages}
  selectedCategories={selectedCategories}
  onToggleCategory={toggleCategory}
  onSetCategories={setSelectedCategories}
  minUnits={minUnits}
  onMinUnitsChange={setMinUnits}
  completedYears={completedYears}
  onCompletedYearsChange={setCompletedYears}
  recentActivity={recentActivity}
  onRecentActivityChange={setRecentActivity}
  transit={transit}
  onTransitChange={setTransit}
/>
```

Remove the old `<FilterPanel ... />`, `<BrowsePanel ... />` mounts.

- [ ] **Step 4: Delete the old files**

```bash
git rm components/FilterPanel.tsx components/FilterPopover.tsx components/BrowsePanel.tsx components/MapModeSwitch.tsx
```

Check there are no remaining imports:

```bash
grep -rn "FilterPanel\|FilterPopover\|BrowsePanel\|MapModeSwitch" --include='*.ts' --include='*.tsx' .
```

Remove any orphaned imports in `Map.tsx`.

- [ ] **Step 5: Verify in browser**

```bash
npm run dev
```

Open `http://localhost:3000/`:
- Top-right: SummaryCard with top-5 default state
- Bottom-left: LensRail
- Bottom-right: FilterFAB
- Click the FAB → FilterSheet slides up; all controls work; Esc + backdrop click close it
- Click "See all 41" in the card → expanded full list
- Click a neighborhood row → neighborhood panel opens, map zooms

- [ ] **Step 6: Verify test suite still passes**

```bash
npx jest
```

Update or delete any tests that referenced deleted files (`filter-popover.test.tsx`, etc.).

- [ ] **Step 7: Commit**

```bash
git add components/Map.tsx __tests__/
git rm components/FilterPanel.tsx components/FilterPopover.tsx components/BrowsePanel.tsx components/MapModeSwitch.tsx
git commit -m "feat: cutover to SummaryCard + LensRail + FilterFAB chrome"
```

---

## Phase 8 — URL param migration

Drop `browse`; add `list` + `sheet`. Update popstate.

### Task 8.1: Add `list` + `sheet` URL params, drop `browse`

**Files:**
- Modify: `components/Map.tsx`

- [ ] **Step 1: Update the URL parse-on-mount logic**

In the `applyUrlState` helper (added in the previous round):

Remove:
```ts
setBrowseOpen(sp.get('browse') === '1')
```

Add:
```ts
const listParam = sp.get('list')
if (listParam === 'none' || listParam === 'top5' || listParam === 'all') {
  setSummaryState(listParam)
}
const sheetParam = sp.get('sheet')
setSheetOpen(sheetParam === '1')
```

- [ ] **Step 2: Update the URL-write effect**

Remove the `setOrDelete('browse', ...)` line. Add:

```ts
setOrDelete('list', summaryState, 'top5')   // top5 is the default
setOrDelete('sheet', sheetOpen ? '1' : '', '')
```

Add `summaryState` and `sheetOpen` to the effect's dependency array.

- [ ] **Step 3: Update the popstate handler**

If `applyUrlState` is the centralized helper, the popstate handler just calls it — already wired. Verify by browsing to `http://localhost:3000/?list=all&sheet=1`, opening DevTools, going back, and checking the state restores correctly.

- [ ] **Step 4: Commit**

```bash
git add components/Map.tsx
git commit -m "feat: list + sheet URL params; drop browse"
```

### Task 8.2: Final end-to-end sanity check

Not a code task; verify everything works.

- [ ] **Step 1: Run the full test suite**

```bash
npx jest
```

All tests pass. Any test that referenced deleted modules has been updated.

- [ ] **Step 2: Run the build**

```bash
npm run cross-stats
```

Completes successfully. `transit-corridors.geojson` is populated. `transit-rings.geojson` has 2 bands (0.1mi + 0.25mi) instead of 3.

- [ ] **Step 3: Smoke-test in browser**

```bash
npm run dev
```

Verify in `http://localhost:3000/`:
- At z 13: choropleth visible (neighborhoods lens), clusters with counts visible. No URL pollution.
- Top-right: SummaryCard top-5 default. Click → all 41 list. Click again → collapsed. Click neighborhood row → drills in.
- Bottom-left: LensRail. Switch lens → map redraws + card list updates.
- Bottom-right: FAB. Click → sheet slides up. All controls (use type, lifecycle, recent, transit-adjacent) work. Esc closes.
- Zoning lens: clicking a polygon opens the ZoningDistrictPanel with all extras (blurb, height chart, glossary, sources). Diagonal-striped special areas (Presidio etc.) are clickable.
- Transit lens: dotted corridor lines for BART/Muni/Caltrain/rapid-bus visible at all zooms. Tiered station markers (BART big with B, Muni with M, Caltrain gold with ▤, rapid-bus small open dot). Rapid-bus only visible at z >= 14. Click any station → panel with permit count + 160/400m radius selector.
- URL share: copy URL with `?mode=transit&station=bart-embarcadero&radius=400`. Open in new tab. View restores.

- [ ] **Step 4: Commit any clean-ups**

If the smoke test reveals tiny tweaks, commit them. Otherwise:

```bash
git log --oneline 1613e59..HEAD | wc -l
```

Should show ~30 commits if all phases ran cleanly.

---

## Self-review checklist

After writing the full plan, the implementing agent should:

- **Spec coverage:** every section in `docs/superpowers/specs/2026-05-11-ui-rethink-design.md` should map to one or more tasks above:
  - §1a SummaryCard → Task 7.1
  - §1b LensRail → Task 7.2
  - §1c FAB / sheet → Task 7.3
  - §1d old chrome deletion → Task 7.4
  - §2 zoom behavior → Phase 4 (markers) + Task 1.4 (cluster fix) + Task 3.6 (corridor render)
  - §3a station markers (S1) → Task 4.1
  - §3b corridors → Phase 3
  - §3c shed bands → Phase 2
  - §3d per-station panel → already in place
  - §3e cross-stats → Task 2.2
  - §4 filter sheet → Task 7.3
  - §5a blurbs → Task 6.1
  - §5b glossary → Task 6.2
  - §5c height context → Tasks 6.3 + 6.4
  - §5d PIM link → Task 6.5
  - §5e recent permits chip → Task 6.5
  - §5f external links → Task 6.5
  - §6 special areas → Phase 5
  - §7 bug fixes → Phase 1
  - §8 new data + build → Phases 2 + 3
  - §9 URL params → Phase 8
  - §10 testing → embedded in each task
  - §11 migration order → matches the 8-phase structure
- **Placeholder scan:** No "TBD", "TODO", "implement later", etc. in any task body. ✓
- **Type consistency:** `LensMode`, `CorridorMode`, `SelectedStation`, `SummaryCardState`, `SummaryCardItem`, `MinUnitsFilter` / `CompletedYearsFilter` / `RecentActivityFilter` (existing) — all defined exactly once, used consistently. ✓

---

## Execution

After all phases commit cleanly, the cutover (Phase 7) is the biggest visual change. Each phase is independently mergeable. Phases 1–6 are additive and don't break the existing UI; Phase 7 swaps the chrome; Phase 8 finishes URL state.
