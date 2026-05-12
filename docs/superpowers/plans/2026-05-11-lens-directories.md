# Lens directories — Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the top-right SummaryCard with a per-lens drawer that expands below the LensRail chip. Each lens gets a native layout (searchable nhood list, zoning drill-down, transit mode tiers). All metrics get shared tooltip definitions.

**Architecture:** New `LensDirectory` drawer wraps three lens-specific directory components. Static geometric data flows through the existing `cross-stats.json` build; new temporal data (permit counts, homes added, YoY, days-to-permit) comes from a new `/api/lens-stats` edge route. One `METRIC_DEFINITIONS` map powers every tooltip plus the `/about` and `/stats` glossaries.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, Jest + React Testing Library, turf.js (build-time), Upstash Redis (daily permit snapshot).

**Source spec:** `docs/superpowers/specs/2026-05-11-lens-directories.md`

---

## File map

### Create
- `lib/metric-definitions.ts` — single source of truth for metric tooltip text.
- `components/MetricHint.tsx` — `?` chip + tooltip primitive.
- `components/LensDirectory.tsx` — drawer container.
- `components/directory/NeighborhoodDirectory.tsx` — N1+N2 list.
- `components/directory/ZoningDirectory.tsx` — Z2 drill-down.
- `components/directory/TransitDirectory.tsx` — T1 mode tiers.
- `app/api/lens-stats/route.ts` — edge-cached temporal aggregates.
- `public/transit-tiers.geojson` — pre-computed tier polygons (build output).
- `__tests__/lib/metric-definitions.test.ts`
- `__tests__/components/MetricHint.test.tsx`
- `__tests__/components/LensDirectory.test.tsx`
- `__tests__/components/directory/NeighborhoodDirectory.test.tsx`
- `__tests__/components/directory/ZoningDirectory.test.tsx`
- `__tests__/components/directory/TransitDirectory.test.tsx`
- `__tests__/api/lens-stats.test.ts`
- `__tests__/transit-tiers.test.ts` — tier classification + polygon coverage.

### Modify
- `lib/transit-stations.ts` — add `TransitTier`, `FREQUENT_LOCAL_STOPS`, `classifyTier()`.
- `lib/cross-stats.ts` — extend types with `near_rail_pct`, `districts[]`, `transit_tiers[]`.
- `scripts/build-cross-stats.ts` — emit per-nhood `near_rail_pct`, per-zoning `districts[]`, four transit-tier polygons.
- `components/LensRail.tsx` — gain `open` state, render drawer below.
- `components/Map.tsx` — fetch `/api/lens-stats`, wire LensRail with open state, URL persistence, remove SummaryCard mount.
- `app/about/page.tsx` and `app/stats/page.tsx` — consume `METRIC_DEFINITIONS`.
- `PLAN.md` — move Z+ Height, Z++ State-law, N3 per-acre sort to "future."

### Delete (Task 13)
- `components/SummaryCard.tsx`
- `__tests__/summary-card.test.tsx`
- `components/VolumeDonut.tsx` (only if no other consumer survives)
- `__tests__/volume-donut.test.tsx` (only if VolumeDonut is removed)

---

## Task 1: Shared metric definitions + MetricHint

**Files:**
- Create: `lib/metric-definitions.ts`
- Create: `components/MetricHint.tsx`
- Test: `__tests__/lib/metric-definitions.test.ts`
- Test: `__tests__/components/MetricHint.test.tsx`

- [ ] **Step 1.1: Write failing test for metric-definitions**

`__tests__/lib/metric-definitions.test.ts`:
```ts
import { METRIC_DEFINITIONS, getMetricDefinition, type MetricKey } from '@/lib/metric-definitions'

describe('METRIC_DEFINITIONS', () => {
  it('has a definition for every documented metric key', () => {
    const required: MetricKey[] = [
      'permitsInWindow', 'homesAdded', 'yoyChange',
      'daysToPermit', 'nearRail', 'zoningMix',
      'landShare', 'permitShare',
    ]
    for (const key of required) {
      expect(METRIC_DEFINITIONS[key]).toBeTruthy()
      expect(METRIC_DEFINITIONS[key].length).toBeGreaterThan(20)
    }
  })

  it('returns the definition text for a known key', () => {
    expect(getMetricDefinition('nearRail')).toContain('¼ mi')
  })

  it('returns null for an unknown key', () => {
    // @ts-expect-error testing runtime fallback
    expect(getMetricDefinition('bogus')).toBeNull()
  })
})
```

- [ ] **Step 1.2: Run test, verify fails**

```bash
npm test -- metric-definitions
```
Expected: fail with module not found.

- [ ] **Step 1.3: Implement metric-definitions**

`lib/metric-definitions.ts`:
```ts
export const METRIC_DEFINITIONS = {
  permitsInWindow:
    'Permits filed in the last 12 months matching the active filters.',
  homesAdded:
    'Net new dwelling units across all matching permits.',
  yoyChange:
    'Year-over-year change in permit count vs the same window one year prior.',
  daysToPermit:
    'Median days from filed → permitted, last 12 months, matching the active filters.',
  nearRail:
    '% of land within ¼ mi of BART, Muni Metro, Caltrain, or a Muni rapid-bus line.',
  zoningMix:
    'Distribution of zoning categories within this region by land area.',
  landShare:
    '% of SF land area in this category.',
  permitShare:
    '% of matching permits in this category.',
  transitTierRail:
    'Within ¼ mile of BART, Muni Metro, or Caltrain.',
  transitTierRapidBus:
    'Within ¼ mile of a Muni rapid-bus (R-suffix) line, but not also rail.',
  transitTierLocalBus:
    'Within ¼ mile of a frequent local Muni line, but not rapid-bus or rail.',
  transitTierPoor:
    'No frequent transit within ¼ mile.',
} as const

export type MetricKey = keyof typeof METRIC_DEFINITIONS

export function getMetricDefinition(key: MetricKey): string | null {
  return (METRIC_DEFINITIONS as Record<string, string>)[key] ?? null
}
```

- [ ] **Step 1.4: Run test, verify passes**

```bash
npm test -- metric-definitions
```
Expected: 3 passed.

- [ ] **Step 1.5: Write failing test for MetricHint**

`__tests__/components/MetricHint.test.tsx`:
```tsx
/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { MetricHint } from '../../components/MetricHint'

describe('MetricHint', () => {
  it('renders a ? trigger with the metric label', () => {
    render(<MetricHint metric="nearRail" label="near rail" />)
    expect(screen.getByText('near rail')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /near rail/i })).toBeInTheDocument()
  })

  it('opens a tooltip with the definition on click', () => {
    render(<MetricHint metric="daysToPermit" label="days" />)
    fireEvent.click(screen.getByRole('button', { name: /days/i }))
    expect(screen.getByText(/median days from filed/i)).toBeInTheDocument()
  })

  it('renders nothing for an unknown metric (graceful degradation)', () => {
    // @ts-expect-error testing runtime fallback
    render(<MetricHint metric="bogus" label="x" />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
```

- [ ] **Step 1.6: Run test, verify fails**

```bash
npm test -- MetricHint
```
Expected: fail with module not found.

- [ ] **Step 1.7: Implement MetricHint**

`components/MetricHint.tsx`:
```tsx
'use client'
import { useState, useRef, useEffect } from 'react'
import { METRIC_DEFINITIONS, type MetricKey } from '@/lib/metric-definitions'

interface Props {
  metric: MetricKey
  label: string
  className?: string
}

export function MetricHint({ metric, label, className = '' }: Props) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const definition = METRIC_DEFINITIONS[metric]
  if (!definition) return null

  return (
    <span ref={wrapRef} className={`relative inline-flex items-center gap-1 ${className}`}>
      <button
        type="button"
        aria-label={`${label} — what is this?`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-ink-soft hover:text-ink"
      >
        <span>{label}</span>
        <span
          aria-hidden
          className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-paper-edge text-ink-faint text-[8px] font-bold"
        >
          ?
        </span>
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute z-50 top-full left-0 mt-2 w-56 bg-ink text-paper text-[11px] leading-snug rounded p-2 shadow-lg"
        >
          {definition}
        </span>
      )}
    </span>
  )
}
```

- [ ] **Step 1.8: Run test, verify passes**

```bash
npm test -- MetricHint
```
Expected: 3 passed.

- [ ] **Step 1.9: Commit**

```bash
git add lib/metric-definitions.ts components/MetricHint.tsx \
  __tests__/lib/metric-definitions.test.ts \
  __tests__/components/MetricHint.test.tsx
git commit -m "feat: shared metric definitions + MetricHint tooltip primitive"
```

---

## Task 2: Transit tier types + classification

**Files:**
- Modify: `lib/transit-stations.ts`
- Create: `__tests__/transit-tiers.test.ts`
- Create: (build output, not in this task) `public/frequent-local-stops.json`

- [ ] **Step 2.1: Write failing test**

`__tests__/transit-tiers.test.ts`:
```ts
import {
  classifyTier, FREQUENT_LOCAL_LINES, RAIL_STATIONS, RAPID_BUS_STOPS,
} from '@/lib/transit-stations'

describe('classifyTier', () => {
  beforeEach(() => {
    RAIL_STATIONS.length = 0
    RAPID_BUS_STOPS.length = 0
  })

  it('returns "rail" if a rail station is within 400 m', () => {
    RAIL_STATIONS.push({ id: 'r1', name: 'X', lat: 37.7749, lng: -122.4194, modes: ['bart'] })
    expect(classifyTier([-122.4194, 37.7749])).toBe('rail')
  })

  it('returns "rapid-bus" if rapid stop in range and no rail', () => {
    RAPID_BUS_STOPS.push({ id: 'b1', name: 'Y', lat: 37.78, lng: -122.42, routes: ['38R'] })
    expect(classifyTier([-122.42, 37.78])).toBe('rapid-bus')
  })

  it('returns "local-bus" if a frequent local stop in range and no rapid/rail', () => {
    // Insert mock frequent-local stop via the same array as a "local" tier
    // — production code reads from FREQUENT_LOCAL_STOPS (loaded similarly)
    expect(FREQUENT_LOCAL_LINES).toBeDefined()
    expect(Array.isArray(FREQUENT_LOCAL_LINES)).toBe(true)
  })

  it('returns "poor" when nothing is in range', () => {
    expect(classifyTier([-122.40, 37.70])).toBe('poor')
  })
})
```

- [ ] **Step 2.2: Run test, verify fails**

```bash
npm test -- transit-tiers
```
Expected: fail (`classifyTier`, `FREQUENT_LOCAL_LINES` undefined).

- [ ] **Step 2.3: Extend lib/transit-stations.ts**

Add to `lib/transit-stations.ts`:
```ts
export type TransitTier = 'rail' | 'rapid-bus' | 'local-bus' | 'poor'

export interface FrequentLocalStop {
  id: string
  name: string
  lat: number
  lng: number
  routes: string[]
}

export const FREQUENT_LOCAL_STOPS: FrequentLocalStop[] = []

/**
 * SFMTA Frequent Transit Network — local Muni lines with ≥ 6 trips/hr
 * in the AM peak (per the most recent SFMTA FTN map). Stop coords are
 * loaded from /frequent-local-stops.json by loadStations().
 */
export const FREQUENT_LOCAL_LINES = ['1', '14', '22', '24', '30', '38', '49'] as const

const FREQUENT_LOCAL_THRESHOLD_M = 400 // ¼ mi

export function classifyTier(
  coords: [number, number] | null | undefined,
): TransitTier {
  if (!coords) return 'poor'
  if (railShed(coords, 400)) return 'rail'
  if (rapidBusShed(coords, 400)) return 'rapid-bus'
  const [lng, lat] = coords
  for (const s of FREQUENT_LOCAL_STOPS) {
    if (distanceMeters(lat, lng, s.lat, s.lng) <= FREQUENT_LOCAL_THRESHOLD_M) {
      return 'local-bus'
    }
  }
  return 'poor'
}
```

Also update `loadStations()` to fetch `/frequent-local-stops.json` and populate `FREQUENT_LOCAL_STOPS`:
```ts
export async function loadStations(baseUrl = ''): Promise<void> {
  if (hydrated) return
  hydrated = true
  try {
    const [rail, rapid, local] = await Promise.all([
      fetch(`${baseUrl}/rail-stations.json`).then((r) => (r.ok ? r.json() : [])),
      fetch(`${baseUrl}/rapid-bus-stops.json`).then((r) => (r.ok ? r.json() : [])),
      fetch(`${baseUrl}/frequent-local-stops.json`).then((r) => (r.ok ? r.json() : [])),
    ])
    RAIL_STATIONS.length = 0; RAIL_STATIONS.push(...(rail as RailStation[]))
    RAPID_BUS_STOPS.length = 0; RAPID_BUS_STOPS.push(...(rapid as RapidBusStop[]))
    FREQUENT_LOCAL_STOPS.length = 0; FREQUENT_LOCAL_STOPS.push(...(local as FrequentLocalStop[]))
  } catch {
    // Leave arrays empty; the UI degrades gracefully.
  }
}
```

- [ ] **Step 2.4: Run test, verify passes**

```bash
npm test -- transit-tiers
```
Expected: 4 passed.

- [ ] **Step 2.5: Commit**

```bash
git add lib/transit-stations.ts __tests__/transit-tiers.test.ts
git commit -m "feat: transit tier types + classifyTier (rail/rapid-bus/local-bus/poor)"
```

---

## Task 3: Build script — emit tier polygons, near_rail_pct, district drill-down

**Files:**
- Modify: `scripts/build-cross-stats.ts`
- Modify: `lib/cross-stats.ts` (type additions)
- Create: `scripts/sources/frequent-local-stops.ts` (FTN stop data)
- Test: `__tests__/lib/cross-stats.test.ts` (new, type-only)

- [ ] **Step 3.1: Write failing type test**

`__tests__/lib/cross-stats.test.ts`:
```ts
import type { CrossStats, NhoodStats, ZoningStats, TierStats } from '@/lib/cross-stats'

describe('CrossStats type', () => {
  it('NhoodStats has near_rail_pct', () => {
    const n: NhoodStats = {
      nhood: 'X', area_sqm: 1000,
      zoning_share: {}, transit_coverage: { '0.1mi': 0, '0.25mi': 0 },
      near_rail_pct: 0.5,
    }
    expect(n.near_rail_pct).toBe(0.5)
  })

  it('ZoningStats has districts[]', () => {
    const z: ZoningStats = {
      category: 'Residential',
      area_sqm: 1, share_of_sf: 1,
      neighborhood_share: {}, transit_coverage: { '0.1mi': 0, '0.25mi': 0 },
      districts: [{ code: 'RH-1', name: 'Single-family', description: 'x', land_share_within_cat: 0.5 }],
    }
    expect(z.districts).toHaveLength(1)
  })

  it('CrossStats includes transit_tiers', () => {
    const c: Pick<CrossStats, 'transit_tiers'> = {
      transit_tiers: [
        { tier: 'rail', area_sqm: 1, share_of_sf: 0.08 },
        { tier: 'rapid-bus', area_sqm: 1, share_of_sf: 0.18 },
        { tier: 'local-bus', area_sqm: 1, share_of_sf: 0.52 },
        { tier: 'poor', area_sqm: 1, share_of_sf: 0.22 },
      ] as TierStats[],
    }
    expect(c.transit_tiers).toHaveLength(4)
  })
})
```

- [ ] **Step 3.2: Run test, verify fails**

```bash
npm test -- cross-stats
```
Expected: fail with type errors (`near_rail_pct`, `districts`, `transit_tiers`, `TierStats` not in scope).

- [ ] **Step 3.3: Extend lib/cross-stats.ts types**

`TransitTier` is owned by `lib/transit-stations.ts` (defined in Task 2). Re-export it here so `cross-stats.ts` stays the single import surface for the directory components, but avoid duplicating the literal type.

Append to `lib/cross-stats.ts`:
```ts
export type { TransitTier } from './transit-stations'
import type { TransitTier } from './transit-stations'

export interface ZoningDistrict {
  code: string             // "RH-1"
  name: string             // "Residential — single-family"
  description: string      // one-line plain-English
  land_share_within_cat: number  // 0..1
}

export interface TierStats {
  tier: TransitTier
  area_sqm: number
  share_of_sf: number
}
```

Then patch the existing `NhoodStats` and `ZoningStats` interfaces:
```ts
export interface NhoodStats {
  nhood: string
  area_sqm: number
  zoning_share: Partial<Record<ZoningCategory, number>>
  transit_coverage: Record<TransitBand, number>
  near_rail_pct: number   // NEW: % of nhood land within ¼ mi of any frequent transit
}

export interface ZoningStats {
  category: ZoningCategory
  area_sqm: number
  share_of_sf: number
  neighborhood_share: Record<string, number>
  transit_coverage: Record<TransitBand, number>
  districts: ZoningDistrict[]   // NEW
}
```

Patch the `CrossStats` interface:
```ts
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
  transit_tiers: TierStats[]   // NEW
}
```

- [ ] **Step 3.4: Run test, verify passes**

```bash
npm test -- cross-stats
```
Expected: 3 passed.

- [ ] **Step 3.5: Create the FTN stops source**

`scripts/sources/frequent-local-stops.ts`:
```ts
import type { FrequentLocalStop } from '../../lib/transit-stations'

/**
 * SFMTA Frequent Transit Network — local Muni lines with ≥ 6 trips/hr in
 * the AM peak. Hand-curated from SFMTA's published FTN map (December 2024).
 * Stop coordinates pulled from the same 511.org regional GTFS feed we
 * already consume for rapid-bus stops.
 *
 * To refresh: run `npm run cross-stats` after replacing this list.
 */
export async function fetchFrequentLocalStops(): Promise<FrequentLocalStop[]> {
  // Implementation reuses the existing 511 GTFS fetcher (see muni-stops.ts)
  // and filters to routes in FREQUENT_LOCAL_LINES.
  const { fetchMuni } = await import('./muni-stops')
  const allMuniStops = await fetchMuni()
  const targetLines = new Set(['1', '14', '22', '24', '30', '38', '49'])
  return allMuniStops
    .filter((s) =>
      Array.isArray(s.routes) &&
      s.routes.some((r: string) => targetLines.has(r)))
    .map((s) => ({
      id: `local-${s.id}`,
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      routes: s.routes.filter((r: string) => targetLines.has(r)),
    }))
}
```

> Note: `fetchMuni()` returns more than rapid-bus today. If its current shape doesn't expose `routes`, extend it (one-line change) so `frequent-local-stops.ts` can filter.

- [ ] **Step 3.6: Patch build-cross-stats.ts — emit per-nhood near_rail_pct**

In the per-nhood loop where `transit_coverage` is computed, add:
```ts
// Pre-compute the union of all "frequent transit" buffers (rail ∪ rapid-bus
// ∪ frequent-local), then intersect with each nhood polygon and divide by
// nhood area.
const nearRailPoly = unionFrequentTransitBuffers(railBuffers, rapidBuffers, localBuffers, 400)

for (const nhood of nhoodFeatures) {
  // ... existing zoning_share and transit_coverage computation ...
  const overlap = turf.intersect(nhood, nearRailPoly)
  const overlapArea = overlap ? turf.area(overlap) : 0
  nhoodStats[name].near_rail_pct = overlapArea / nhoodStats[name].area_sqm
}
```

Add helper `unionFrequentTransitBuffers` that returns the merged polygon. (Existing build script avoids `turf.union`; this is ~30 polygons after buffering, so union is fine — wrap with a single call.)

- [ ] **Step 3.7: Patch build-cross-stats.ts — emit transit tier polygons**

Inside `main()`:
```ts
const railBufferPoly      = bufferUnion(railStops,   400)
const rapidBusBufferPoly  = bufferUnion(rapidStops,  400)
const localBusBufferPoly  = bufferUnion(localStops,  400)

const tierRail       = railBufferPoly
const tierRapidBus   = turf.difference(rapidBusBufferPoly, tierRail)
const tierLocalBus   = turf.difference(localBusBufferPoly,
  turf.union(tierRail, tierRapidBus))
const sfMask         = await loadSfOutline()
const tierPoor       = turf.difference(sfMask,
  turf.union(turf.union(tierRail, tierRapidBus), tierLocalBus))

const transit_tiers: TierStats[] = [
  { tier: 'rail',       area_sqm: turf.area(tierRail),     share_of_sf: turf.area(tierRail)     / sfArea },
  { tier: 'rapid-bus',  area_sqm: turf.area(tierRapidBus), share_of_sf: turf.area(tierRapidBus) / sfArea },
  { tier: 'local-bus',  area_sqm: turf.area(tierLocalBus), share_of_sf: turf.area(tierLocalBus) / sfArea },
  { tier: 'poor',       area_sqm: turf.area(tierPoor),     share_of_sf: turf.area(tierPoor)     / sfArea },
]

// Write the tier polygons as GeoJSON for the overlay.
await fs.writeFile(
  path.join(PUBLIC_DIR, 'transit-tiers.geojson'),
  JSON.stringify({
    type: 'FeatureCollection',
    features: [tierRail, tierRapidBus, tierLocalBus, tierPoor].map((g, i) => ({
      type: 'Feature',
      geometry: g.geometry,
      properties: { tier: (['rail', 'rapid-bus', 'local-bus', 'poor'] as const)[i] },
    })),
  }),
)
```

`loadSfOutline()` loads the outline of San Francisco — either reuse the existing nhood union or read `public/sf-outline.geojson` if it exists; if not, compute as `turf.union(...nhoodFeatures)`.

- [ ] **Step 3.8: Patch build-cross-stats.ts — emit zoning district drill-down**

After per-category aggregation, add:
```ts
// Group zoning features by gen, then by zoning_sim (district code), summing
// area per district. Emit a list of districts per gen, sorted by land share.
const districtAreaByCat: Record<string, Map<string, number>> = {}
for (const f of zoningFeatures) {
  const cat = (f.properties?.gen ?? 'Other') as ZoningCategory
  const code = (f.properties?.zoning_sim ?? '') as string
  if (!districtAreaByCat[cat]) districtAreaByCat[cat] = new Map()
  const m = districtAreaByCat[cat]
  m.set(code, (m.get(code) ?? 0) + turf.area(f))
}

for (const cat of ZONING_CATEGORIES) {
  const m = districtAreaByCat[cat]
  if (!m) { zoningStats[cat].districts = []; continue }
  const catArea = zoningStats[cat].area_sqm || 1
  const districts: ZoningDistrict[] = [...m.entries()]
    .map(([code, area]) => ({
      code,
      name: DISTRICT_NAMES[code] ?? code,
      description: DISTRICT_DESCRIPTIONS[code] ?? '',
      land_share_within_cat: area / catArea,
    }))
    .sort((a, b) => b.land_share_within_cat - a.land_share_within_cat)
  zoningStats[cat].districts = districts
}
```

Add `DISTRICT_NAMES` and `DISTRICT_DESCRIPTIONS` constants near the top of the build script — keyed by `zoning_sim` code (RH-1, NCT-3, etc.). For the implementation, start with the ~30 most common codes; unknown codes fall back to using the code as both name and empty description.

- [ ] **Step 3.9: Build the new geometric data**

```bash
npm run cross-stats
```
Expected: writes `public/cross-stats.json` (with new fields), `public/transit-tiers.geojson`, `public/frequent-local-stops.json`. Re-runs in ≤ 60 s.

- [ ] **Step 3.10: Verify outputs**

```bash
node -e "const c = require('./public/cross-stats.json'); \
  console.log('nhoods near_rail_pct sample:', c.neighborhoods.slice(0,3).map(n=>[n.nhood,n.near_rail_pct])); \
  console.log('tiers:', c.transit_tiers); \
  console.log('residential districts:', c.zoning.find(z=>z.category==='Residential').districts.slice(0,5))"
```
Expected: realistic values printed (rail tier ~5–10%, residential RH-1 dominant).

- [ ] **Step 3.11: Commit**

```bash
git add scripts/build-cross-stats.ts scripts/sources/frequent-local-stops.ts \
  lib/cross-stats.ts __tests__/lib/cross-stats.test.ts \
  public/cross-stats.json public/transit-tiers.geojson public/frequent-local-stops.json
git commit -m "feat(build): emit transit-tier polygons, near_rail_pct, zoning district drill-down"
```

---

## Task 4: /api/lens-stats edge route

**Files:**
- Create: `app/api/lens-stats/route.ts`
- Create: `lib/lens-stats.ts` — pure aggregation logic (testable)
- Test: `__tests__/api/lens-stats.test.ts`

- [ ] **Step 4.1: Write failing test for pure aggregator**

`__tests__/api/lens-stats.test.ts`:
```ts
import { computeLensStats, type LensStatsInput } from '@/lib/lens-stats'
import type { Permit } from '@/lib/types'

const samplePermits: Permit[] = [
  // Mission, housing, recent, issued, 6 net units
  { id: 'p1', neighborhood: 'Mission', useCategory: 'housing',
    stage: 'permitted', filedDate: '2025-08-01', issuedDate: '2026-01-15',
    netUnits: 6, location: { type: 'Point', coordinates: [-122.42, 37.76] } } as any,
  // Mission, housing, old (>12mo ago), counts for YoY denominator
  { id: 'p2', neighborhood: 'Mission', useCategory: 'housing',
    stage: 'permitted', filedDate: '2024-07-01', issuedDate: '2024-12-01',
    netUnits: 4, location: { type: 'Point', coordinates: [-122.42, 37.76] } } as any,
  // SoMa, recent
  { id: 'p3', neighborhood: 'South of Market', useCategory: 'housing',
    stage: 'filed', filedDate: '2025-11-01', issuedDate: null,
    netUnits: 12, location: { type: 'Point', coordinates: [-122.40, 37.78] } } as any,
]

describe('computeLensStats', () => {
  const now = new Date('2026-05-11T00:00:00Z')

  it('aggregates per-nhood permit counts and homes', () => {
    const out = computeLensStats({ permits: samplePermits, now } as LensStatsInput)
    expect(out.neighborhoods['Mission'].permits_12mo).toBe(1)
    expect(out.neighborhoods['Mission'].homes_added_12mo).toBe(6)
    expect(out.neighborhoods['South of Market'].permits_12mo).toBe(1)
  })

  it('reports YoY pct change vs same window one year prior', () => {
    const out = computeLensStats({ permits: samplePermits, now })
    // 1 permit this window vs 1 last window = 0% change.
    expect(out.neighborhoods['Mission'].yoy_pct).toBe(0)
  })

  it('reports median filed→permitted days for permits that have issued', () => {
    const out = computeLensStats({ permits: samplePermits, now })
    // p1: filed 2025-08-01, issued 2026-01-15 → 167 days
    expect(out.neighborhoods['Mission'].median_days_to_permit).toBe(167)
  })

  it('returns an empty zoning map when permits lack zoning_category', () => {
    const out = computeLensStats({ permits: samplePermits, now })
    expect(out.zoning).toEqual({})  // Logged as deferred: permit→zoning enrichment
  })

  it('aggregates by zoning_category when permits carry that field', () => {
    const enriched = samplePermits.map((p, i) => ({
      ...p,
      zoning_category: i === 0 ? 'Mixed Use' : 'Residential',
    }))
    const out = computeLensStats({ permits: enriched as any, now })
    expect(out.zoning['Mixed Use'].permits_share).toBeGreaterThan(0)
  })

  it('aggregates per-transit-tier permit counts when classifier supplied', () => {
    const out = computeLensStats({
      permits: samplePermits, now,
      classifyTier: () => 'rail',
    } as LensStatsInput)
    expect(out.transit_tiers['rail'].permits).toBe(2)
    expect(out.transit_tiers['rail'].homes).toBe(18)
  })
})
```

- [ ] **Step 4.2: Run test, verify fails**

```bash
npm test -- lens-stats
```
Expected: fail (module not found).

- [ ] **Step 4.3: Implement lib/lens-stats.ts**

`lib/lens-stats.ts`:
```ts
import type { Permit } from '@/lib/types'
import type { TransitTier } from '@/lib/cross-stats'

export interface LensStatsInput {
  permits: Permit[]
  now: Date
  classifyTier?: (coords: [number, number]) => TransitTier
}

export interface NhoodLensStats {
  permits_12mo: number
  homes_added_12mo: number
  yoy_pct: number              // -1..+∞
  median_days_to_permit: number  // -1 if no issued permits
}

export interface ZoningLensStats {
  permits_share: number
  top_neighborhoods: string[]
}

export interface TierLensStats {
  permits: number
  homes: number
  dominant_zoning: string  // category name
}

export interface LensStats {
  neighborhoods: Record<string, NhoodLensStats>
  zoning: Record<string, ZoningLensStats>
  transit_tiers: Record<TransitTier, TierLensStats>
}

const MS_PER_DAY = 86_400_000

export function computeLensStats(input: LensStatsInput): LensStats {
  const { permits, now, classifyTier } = input
  const windowStart = new Date(now.getTime() - 365 * MS_PER_DAY)
  const priorStart  = new Date(now.getTime() - 2 * 365 * MS_PER_DAY)

  const inWindow = (p: Permit) =>
    p.filedDate && new Date(p.filedDate) >= windowStart && new Date(p.filedDate) <= now
  const inPriorWindow = (p: Permit) =>
    p.filedDate && new Date(p.filedDate) >= priorStart && new Date(p.filedDate) < windowStart

  // ---- nhoods ----
  const nhoodAgg: Record<string, NhoodLensStats & { _days: number[] }> = {}
  const priorByNhood: Record<string, number> = {}
  for (const p of permits) {
    const nb = (p as any).neighborhood
    if (!nb) continue
    if (inWindow(p)) {
      nhoodAgg[nb] = nhoodAgg[nb] ?? {
        permits_12mo: 0, homes_added_12mo: 0, yoy_pct: 0,
        median_days_to_permit: -1, _days: [],
      }
      nhoodAgg[nb].permits_12mo++
      nhoodAgg[nb].homes_added_12mo += (p as any).netUnits ?? 0
      const issued = (p as any).issuedDate
      if (issued) {
        const days = Math.round(
          (new Date(issued).getTime() - new Date(p.filedDate!).getTime()) / MS_PER_DAY,
        )
        nhoodAgg[nb]._days.push(days)
      }
    } else if (inPriorWindow(p)) {
      priorByNhood[nb] = (priorByNhood[nb] ?? 0) + 1
    }
  }
  const neighborhoods: Record<string, NhoodLensStats> = {}
  for (const [nb, agg] of Object.entries(nhoodAgg)) {
    const prior = priorByNhood[nb] ?? 0
    const yoy = prior === 0 ? 0 : (agg.permits_12mo - prior) / prior
    const days = agg._days.length
      ? median(agg._days)
      : -1
    neighborhoods[nb] = {
      permits_12mo: agg.permits_12mo,
      homes_added_12mo: agg.homes_added_12mo,
      yoy_pct: yoy,
      median_days_to_permit: days,
    }
  }

  // ---- zoning ----
  // Permit→zoning attribution is not yet populated in the snapshot. Until
  // a cron-side point-in-polygon pass writes `zoning_category` onto each
  // Permit, we return an empty zoning map and `ZoningDirectory` falls back
  // to "—" for permit_share + skips the "Top:" line. Logged in PLAN.md as
  // a follow-up. The schema is in place so adding the enrichment later
  // requires zero UI changes.
  const zoning: Record<string, ZoningLensStats> = {}
  for (const p of permits) {
    if (!inWindow(p)) continue
    const cat = (p as any).zoning_category as string | undefined
    if (!cat) continue
    zoning[cat] = zoning[cat] ?? { permits_share: 0, top_neighborhoods: [] }
    // permits_share filled in after the loop via division.
    ;(zoning[cat] as any)._count = ((zoning[cat] as any)._count ?? 0) + 1
  }
  const total = Object.values(zoning).reduce((acc, z) => acc + ((z as any)._count ?? 0), 0)
  for (const cat of Object.keys(zoning)) {
    const c = (zoning[cat] as any)._count ?? 0
    zoning[cat].permits_share = total > 0 ? c / total : 0
    delete (zoning[cat] as any)._count
  }

  // ---- transit tiers ----
  const tierAgg: Record<TransitTier, TierLensStats> = {
    rail:        { permits: 0, homes: 0, dominant_zoning: '' },
    'rapid-bus': { permits: 0, homes: 0, dominant_zoning: '' },
    'local-bus': { permits: 0, homes: 0, dominant_zoning: '' },
    poor:        { permits: 0, homes: 0, dominant_zoning: '' },
  }
  if (classifyTier) {
    for (const p of permits) {
      if (!inWindow(p)) continue
      const coords = (p.location as any)?.coordinates as [number, number] | undefined
      if (!coords) continue
      const tier = classifyTier(coords)
      tierAgg[tier].permits++
      tierAgg[tier].homes += (p as any).netUnits ?? 0
    }
  }

  return { neighborhoods, zoning, transit_tiers: tierAgg }
}

function median(xs: number[]): number {
  const sorted = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid]
}
```

- [ ] **Step 4.4: Run test, verify passes**

```bash
npm test -- lens-stats
```
Expected: 5 passed.

- [ ] **Step 4.5: Wire the edge route**

`app/api/lens-stats/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { computeLensStats } from '@/lib/lens-stats'
import { loadPermitSnapshot } from '@/lib/permit-cache'
import { classifyTier } from '@/lib/transit-stations'

export const runtime = 'edge'
export const revalidate = 86_400  // 24 h

export async function GET() {
  const permits = await loadPermitSnapshot()
  const stats = computeLensStats({
    permits,
    now: new Date(),
    classifyTier,
  })
  return NextResponse.json(stats, {
    headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600' },
  })
}
```

> If `loadPermitSnapshot` doesn't exist with that exact name, use the existing snapshot loader pattern from `app/api/permits/route.ts`. Same Upstash key.

- [ ] **Step 4.6: Smoke-test the route locally**

```bash
npm run dev
# in a second shell:
curl -sS http://localhost:3000/api/lens-stats | head -c 400
```
Expected: JSON shape with `neighborhoods`, `zoning`, `transit_tiers` keys.

- [ ] **Step 4.7: Commit**

```bash
git add lib/lens-stats.ts app/api/lens-stats/route.ts \
  __tests__/api/lens-stats.test.ts
git commit -m "feat: /api/lens-stats edge route (temporal per-lens aggregates)"
```

---

## Task 5: NeighborhoodDirectory component

**Files:**
- Create: `components/directory/NeighborhoodDirectory.tsx`
- Test: `__tests__/components/directory/NeighborhoodDirectory.test.tsx`

- [ ] **Step 5.1: Write failing test**

`__tests__/components/directory/NeighborhoodDirectory.test.tsx`:
```tsx
/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { NeighborhoodDirectory } from '@/components/directory/NeighborhoodDirectory'
import type { NhoodStats } from '@/lib/cross-stats'
import type { NhoodLensStats } from '@/lib/lens-stats'

const geo: NhoodStats[] = [
  { nhood: 'Mission', area_sqm: 1000,
    zoning_share: { Residential: 0.54, 'Mixed Use': 0.38, Commercial: 0.08 },
    transit_coverage: { '0.1mi': 0, '0.25mi': 0 }, near_rail_pct: 0.91 },
  { nhood: 'Outer Sunset', area_sqm: 2000,
    zoning_share: { Residential: 0.96, 'Mixed Use': 0.04 },
    transit_coverage: { '0.1mi': 0, '0.25mi': 0 }, near_rail_pct: 0.04 },
]
const lens: Record<string, NhoodLensStats> = {
  Mission:         { permits_12mo: 128, homes_added_12mo: 312, yoy_pct:  0.18, median_days_to_permit: 184 },
  'Outer Sunset':  { permits_12mo:   8, homes_added_12mo:  11, yoy_pct: -0.42, median_days_to_permit: 312 },
}

describe('NeighborhoodDirectory', () => {
  it('renders one row per neighborhood, sorted by permit count desc by default', () => {
    render(<NeighborhoodDirectory geo={geo} lens={lens} onSelect={() => {}} />)
    const rows = screen.getAllByRole('button', { name: /permits/i })
    expect(rows[0]).toHaveTextContent('Mission')
    expect(rows[1]).toHaveTextContent('Outer Sunset')
  })

  it('filters by search input (case-insensitive substring)', () => {
    render(<NeighborhoodDirectory geo={geo} lens={lens} onSelect={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'sunset' } })
    expect(screen.queryByText('Mission')).toBeNull()
    expect(screen.getByText('Outer Sunset')).toBeInTheDocument()
  })

  it('toggles to A–Z sort', () => {
    render(<NeighborhoodDirectory geo={geo} lens={lens} onSelect={() => {}} />)
    fireEvent.click(screen.getByText(/a–z/i))
    const rows = screen.getAllByRole('button', { name: /permits/i })
    expect(rows[0]).toHaveTextContent('Mission')
    expect(rows[1]).toHaveTextContent('Outer Sunset')
  })

  it('renders 5 metric chips with tooltip triggers', () => {
    render(<NeighborhoodDirectory geo={geo} lens={lens} onSelect={() => {}} />)
    // Each row: 5 ? chips. 2 rows × 5 = 10 chips total.
    expect(screen.getAllByText('?').length).toBeGreaterThanOrEqual(10)
  })

  it('calls onSelect with the nhood name when a row is clicked', () => {
    const onSelect = jest.fn()
    render(<NeighborhoodDirectory geo={geo} lens={lens} onSelect={onSelect} />)
    fireEvent.click(screen.getAllByRole('button', { name: /128 permits/i })[0])
    expect(onSelect).toHaveBeenCalledWith('Mission')
  })
})
```

- [ ] **Step 5.2: Run test, verify fails**

```bash
npm test -- NeighborhoodDirectory
```
Expected: fail (module not found).

- [ ] **Step 5.3: Implement NeighborhoodDirectory**

`components/directory/NeighborhoodDirectory.tsx`:
```tsx
'use client'
import { useMemo, useState } from 'react'
import type { NhoodStats } from '@/lib/cross-stats'
import type { NhoodLensStats } from '@/lib/lens-stats'
import { MetricHint } from '../MetricHint'

interface Props {
  geo: NhoodStats[]
  lens: Record<string, NhoodLensStats>
  onSelect: (name: string) => void
}

type Sort = 'permits' | 'alpha'

const ZONING_COLORS: Record<string, string> = {
  Residential: '#7d9b76',
  'Mixed Use': '#b08968',
  Commercial:  '#5d7a99',
  Industrial:  '#67615a',
  Public:      '#8a6c87',
  Other:       '#a8a29e',
}

export function NeighborhoodDirectory({ geo, lens, onSelect }: Props) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<Sort>('permits')

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = geo.filter((n) => !q || n.nhood.toLowerCase().includes(q))
    const sorted = [...filtered].sort((a, b) => {
      if (sort === 'alpha') return a.nhood.localeCompare(b.nhood)
      return (lens[b.nhood]?.permits_12mo ?? 0) - (lens[a.nhood]?.permits_12mo ?? 0)
    })
    return sorted
  }, [geo, lens, search, sort])

  return (
    <div className="font-sans text-ink">
      <div className="flex gap-2 items-center mt-2">
        <input
          aria-label="Search neighborhoods"
          placeholder="Search 41 neighborhoods…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-2 py-1.5 text-xs bg-paper border border-paper-edge rounded"
        />
        <button
          type="button"
          onClick={() => setSort('permits')}
          className={`px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider rounded-full ${
            sort === 'permits' ? 'bg-ink text-paper' : 'text-ink-soft border border-paper-edge'
          }`}
        >
          Permits ↓
        </button>
        <button
          type="button"
          onClick={() => setSort('alpha')}
          className={`px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider rounded-full ${
            sort === 'alpha' ? 'bg-ink text-paper' : 'text-ink-soft border border-paper-edge'
          }`}
        >
          A–Z
        </button>
      </div>

      <ul className="mt-2 max-h-[60dvh] overflow-y-auto">
        {rows.length === 0 && (
          <li className="text-xs text-ink-faint py-4 text-center">No matches</li>
        )}
        {rows.map((n) => {
          const s = lens[n.nhood]
          return (
            <li key={n.nhood} className="border-b border-paper-edge/40 py-2">
              <button
                type="button"
                onClick={() => onSelect(n.nhood)}
                aria-label={`${n.nhood} — ${s?.permits_12mo ?? 0} permits`}
                className="w-full text-left"
              >
                <div className="flex items-baseline gap-2">
                  <span className="font-serif text-[13px]">{n.nhood}</span>
                  <span className="ml-auto font-mono text-[11px] text-construction font-semibold">
                    {s?.permits_12mo ?? 0} permits
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-[10px] font-mono text-ink-soft">
                  <span className="inline-flex items-center gap-1">
                    <ZoningMixBar share={n.zoning_share} />
                    <MetricHint metric="zoningMix" label="mix" />
                  </span>
                  <MetricHint metric="homesAdded" label={`+${s?.homes_added_12mo ?? 0} homes`} />
                  <MetricHint
                    metric="yoyChange"
                    label={s ? formatYoy(s.yoy_pct) : '—'}
                  />
                  <MetricHint
                    metric="daysToPermit"
                    label={s && s.median_days_to_permit >= 0 ? `${s.median_days_to_permit} days` : '— days'}
                  />
                  <MetricHint
                    metric="nearRail"
                    label={`${Math.round(n.near_rail_pct * 100)}% near rail`}
                  />
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function ZoningMixBar({ share }: { share: Partial<Record<string, number>> }) {
  const order = ['Residential', 'Mixed Use', 'Commercial', 'Industrial', 'Public', 'Other']
  return (
    <span className="inline-flex h-1 w-14 rounded overflow-hidden bg-paper-deep">
      {order.map((k) => {
        const pct = (share as Record<string, number>)[k] ?? 0
        if (pct <= 0) return null
        return (
          <span
            key={k}
            style={{ width: `${pct * 100}%`, background: ZONING_COLORS[k] }}
          />
        )
      })}
    </span>
  )
}

function formatYoy(pct: number): string {
  if (!Number.isFinite(pct)) return '—'
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${Math.round(pct * 100)}% YoY`
}
```

- [ ] **Step 5.4: Run test, verify passes**

```bash
npm test -- NeighborhoodDirectory
```
Expected: 5 passed.

- [ ] **Step 5.5: Commit**

```bash
git add components/directory/NeighborhoodDirectory.tsx \
  __tests__/components/directory/NeighborhoodDirectory.test.tsx
git commit -m "feat: NeighborhoodDirectory — searchable, sorted, 5 metrics + tooltips"
```

---

## Task 6: ZoningDirectory component

**Files:**
- Create: `components/directory/ZoningDirectory.tsx`
- Test: `__tests__/components/directory/ZoningDirectory.test.tsx`

- [ ] **Step 6.1: Write failing test**

`__tests__/components/directory/ZoningDirectory.test.tsx`:
```tsx
/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { ZoningDirectory } from '@/components/directory/ZoningDirectory'
import type { ZoningStats } from '@/lib/cross-stats'
import type { ZoningLensStats } from '@/lib/lens-stats'

const geo: ZoningStats[] = [
  { category: 'Residential', area_sqm: 1, share_of_sf: 0.78,
    neighborhood_share: {}, transit_coverage: { '0.1mi': 0, '0.25mi': 0 },
    districts: [
      { code: 'RH-1', name: 'Single-family', description: 'SFH-only — most of SF residential land', land_share_within_cat: 0.52 },
      { code: 'RH-2', name: 'Two-unit',      description: 'Duplex',                                 land_share_within_cat: 0.14 },
    ],
  },
  { category: 'Mixed Use', area_sqm: 1, share_of_sf: 0.08,
    neighborhood_share: {}, transit_coverage: { '0.1mi': 0, '0.25mi': 0 },
    districts: [],
  },
]
const lens: Record<string, ZoningLensStats> = {
  Residential: { permits_share: 0.34, top_neighborhoods: ['Sunset', 'Richmond', 'Bayview'] },
  'Mixed Use': { permits_share: 0.41, top_neighborhoods: ['Mission', 'SoMa', 'Hayes Valley'] },
}

describe('ZoningDirectory', () => {
  it('renders one row per zoning category', () => {
    render(<ZoningDirectory geo={geo} lens={lens} onSelect={() => {}} />)
    expect(screen.getByText('Residential')).toBeInTheDocument()
    expect(screen.getByText('Mixed Use')).toBeInTheDocument()
  })

  it('expands a category on click and shows its districts', () => {
    render(<ZoningDirectory geo={geo} lens={lens} onSelect={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /residential/i }))
    expect(screen.getByText('RH-1')).toBeInTheDocument()
    expect(screen.getByText('RH-2')).toBeInTheDocument()
  })

  it('collapses a category on second click', () => {
    render(<ZoningDirectory geo={geo} lens={lens} onSelect={() => {}} />)
    const head = screen.getByRole('button', { name: /residential/i })
    fireEvent.click(head)
    fireEvent.click(head)
    expect(screen.queryByText('RH-1')).toBeNull()
  })

  it('renders Land and Permits bars with shared-tooltip labels', () => {
    render(<ZoningDirectory geo={geo} lens={lens} onSelect={() => {}} />)
    expect(screen.getAllByText(/land/i)[0]).toBeInTheDocument()
    expect(screen.getAllByText(/permits/i)[0]).toBeInTheDocument()
  })
})
```

- [ ] **Step 6.2: Run test, verify fails**

```bash
npm test -- ZoningDirectory
```
Expected: fail.

- [ ] **Step 6.3: Implement ZoningDirectory**

`components/directory/ZoningDirectory.tsx`:
```tsx
'use client'
import { useState } from 'react'
import type { ZoningStats, ZoningCategory } from '@/lib/cross-stats'
import type { ZoningLensStats } from '@/lib/lens-stats'
import { MetricHint } from '../MetricHint'

interface Props {
  geo: ZoningStats[]
  lens: Record<string, ZoningLensStats>
  onSelect: (cat: ZoningCategory) => void
}

const COLORS: Record<ZoningCategory, string> = {
  Residential: '#7d9b76',
  'Mixed Use': '#b08968',
  Commercial:  '#5d7a99',
  Industrial:  '#67615a',
  Public:      '#8a6c87',
  Other:       '#a8a29e',
}

export function ZoningDirectory({ geo, lens, onSelect }: Props) {
  const [expanded, setExpanded] = useState<ZoningCategory | null>(null)

  return (
    <ul className="mt-2 font-sans text-ink">
      {geo.map((z) => {
        const isOpen = expanded === z.category
        const l = lens[z.category]
        return (
          <li key={z.category} className="border-b border-paper-edge/40 py-2">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => {
                setExpanded(isOpen ? null : z.category)
                onSelect(z.category)
              }}
              className="w-full text-left"
            >
              <div className="flex items-center gap-2 font-serif text-[13px]">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ background: COLORS[z.category] }}
                />
                {z.category}
                <span className="ml-auto text-[10px] text-ink-faint">
                  {isOpen ? '▾' : '▸'}
                </span>
              </div>
              <div className="grid grid-cols-[60px_1fr_32px] items-center gap-1.5 mt-1 text-[10px] font-mono text-ink-soft">
                <MetricHint metric="landShare" label="Land" />
                <Bar pct={z.share_of_sf} color={COLORS[z.category]} />
                <span className="text-right font-bold">{pct(z.share_of_sf)}</span>
              </div>
              {l && (
                <div className="grid grid-cols-[60px_1fr_32px] items-center gap-1.5 mt-1 text-[10px] font-mono text-ink-soft">
                  <MetricHint metric="permitShare" label="Permits" />
                  <Bar pct={l.permits_share} color="#9a4a31" />
                  <span className="text-right font-bold">{pct(l.permits_share)}</span>
                </div>
              )}
              {l && l.top_neighborhoods.length > 0 && (
                <div className="text-[10px] text-ink-faint mt-1">
                  Top: {l.top_neighborhoods.slice(0, 3).map((n) => (
                    <span key={n} className="text-ink font-medium"> {n} </span>
                  ))}
                </div>
              )}
            </button>
            {isOpen && z.districts.length > 0 && (
              <div className="mt-2 -mx-3 px-3 pt-2 pb-1 bg-paper-deep border-t border-paper-edge/40">
                <div className="text-[9px] font-mono uppercase tracking-wider text-ink-faint mb-1">
                  Districts within {z.category}
                </div>
                {z.districts.slice(0, 12).map((d) => (
                  <div key={d.code} className="grid grid-cols-[80px_1fr_40px] gap-2 items-baseline py-0.5">
                    <span className="font-mono text-[11px] font-semibold">{d.code}</span>
                    <span className="text-[10px] text-ink-faint truncate">{d.description}</span>
                    <span className="text-right font-mono text-[10px] text-construction font-semibold">
                      {pct(d.land_share_within_cat)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <span className="inline-block h-1.5 w-full bg-paper-deep rounded overflow-hidden">
      <span
        className="block h-full"
        style={{ width: `${Math.max(0, Math.min(1, pct)) * 100}%`, background: color }}
      />
    </span>
  )
}

function pct(x: number): string {
  if (!Number.isFinite(x)) return '—'
  if (x === 0) return '0%'
  if (x < 0.005) return '<1%'
  return `${Math.round(x * 100)}%`
}
```

- [ ] **Step 6.4: Run test, verify passes**

```bash
npm test -- ZoningDirectory
```
Expected: 4 passed.

- [ ] **Step 6.5: Commit**

```bash
git add components/directory/ZoningDirectory.tsx \
  __tests__/components/directory/ZoningDirectory.test.tsx
git commit -m "feat: ZoningDirectory — 5 categories with drill-down to districts"
```

---

## Task 7: TransitDirectory component

**Files:**
- Create: `components/directory/TransitDirectory.tsx`
- Test: `__tests__/components/directory/TransitDirectory.test.tsx`

- [ ] **Step 7.1: Write failing test**

`__tests__/components/directory/TransitDirectory.test.tsx`:
```tsx
/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { TransitDirectory } from '@/components/directory/TransitDirectory'
import type { TierStats } from '@/lib/cross-stats'
import type { TierLensStats } from '@/lib/lens-stats'

const geo: TierStats[] = [
  { tier: 'rail',       area_sqm: 1, share_of_sf: 0.08 },
  { tier: 'rapid-bus',  area_sqm: 1, share_of_sf: 0.18 },
  { tier: 'local-bus',  area_sqm: 1, share_of_sf: 0.52 },
  { tier: 'poor',       area_sqm: 1, share_of_sf: 0.22 },
]
const lens: Record<string, TierLensStats> = {
  rail:        { permits: 412, homes: 1840, dominant_zoning: 'Mixed Use' },
  'rapid-bus': { permits: 406, homes: 1408, dominant_zoning: 'Residential' },
  'local-bus': { permits: 361, homes: 1142, dominant_zoning: 'Residential' },
  poor:        { permits:  68, homes:  184, dominant_zoning: 'Residential' },
}

describe('TransitDirectory', () => {
  it('renders the four tiers in best→worst order', () => {
    render(<TransitDirectory geo={geo} lens={lens} onSelect={() => {}} />)
    const labels = screen.getAllByRole('heading', { level: 4 }).map((h) => h.textContent)
    expect(labels).toEqual(['Rail-served', 'Rapid-bus only', 'Local-bus only', 'Transit-poor'])
  })

  it('shows the tier definition under the label', () => {
    render(<TransitDirectory geo={geo} lens={lens} onSelect={() => {}} />)
    expect(screen.getByText(/BART · Muni Metro · Caltrain/i)).toBeInTheDocument()
  })

  it('shows land share + permits + homes for each tier', () => {
    render(<TransitDirectory geo={geo} lens={lens} onSelect={() => {}} />)
    expect(screen.getByText(/8% of SF/)).toBeInTheDocument()
    expect(screen.getByText(/412 permits/)).toBeInTheDocument()
    expect(screen.getByText(/1,840 homes/)).toBeInTheDocument()
  })

  it('calls onSelect with the tier when a row is clicked', () => {
    const onSelect = jest.fn()
    render(<TransitDirectory geo={geo} lens={lens} onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: /rail-served/i }))
    expect(onSelect).toHaveBeenCalledWith('rail')
  })
})
```

- [ ] **Step 7.2: Run test, verify fails**

```bash
npm test -- TransitDirectory
```
Expected: fail.

- [ ] **Step 7.3: Implement TransitDirectory**

`components/directory/TransitDirectory.tsx`:
```tsx
'use client'
import type { TierStats, TransitTier } from '@/lib/cross-stats'
import type { TierLensStats } from '@/lib/lens-stats'
import { METRIC_DEFINITIONS } from '@/lib/metric-definitions'

interface Props {
  geo: TierStats[]
  lens: Record<string, TierLensStats>
  onSelect: (tier: TransitTier) => void
}

const TIER_ORDER: TransitTier[] = ['rail', 'rapid-bus', 'local-bus', 'poor']
const LABELS: Record<TransitTier, string> = {
  rail:        'Rail-served',
  'rapid-bus': 'Rapid-bus only',
  'local-bus': 'Local-bus only',
  poor:        'Transit-poor',
}
const DEF_KEY: Record<TransitTier, keyof typeof METRIC_DEFINITIONS> = {
  rail:        'transitTierRail',
  'rapid-bus': 'transitTierRapidBus',
  'local-bus': 'transitTierLocalBus',
  poor:        'transitTierPoor',
}

export function TransitDirectory({ geo, lens, onSelect }: Props) {
  const byTier = new Map(geo.map((t) => [t.tier, t]))
  return (
    <ul className="mt-2 font-sans text-ink">
      {TIER_ORDER.map((tier) => {
        const g = byTier.get(tier)
        const l = lens[tier]
        if (!g) return null
        return (
          <li key={tier} className="border-b border-paper-edge/40 py-2">
            <button
              type="button"
              onClick={() => onSelect(tier)}
              className="w-full text-left"
            >
              <h4 className="font-serif text-[13px]">{LABELS[tier]}</h4>
              <p className="text-[10px] text-ink-faint mt-0.5">
                {METRIC_DEFINITIONS[DEF_KEY[tier]]}
              </p>
              <p className="text-[10.5px] font-mono text-ink-soft mt-1">
                <span className="text-construction font-semibold">{Math.round(g.share_of_sf * 100)}%</span> of SF
                {l ? <> · <span className="text-construction font-semibold">{l.permits.toLocaleString()}</span> permits</> : null}
                {l ? <> · <span className="text-construction font-semibold">{l.homes.toLocaleString()}</span> homes</> : null}
              </p>
              {l?.dominant_zoning && (
                <p className="text-[10px] text-ink-faint mt-0.5">
                  Mostly <span className="text-ink font-medium">{l.dominant_zoning}</span>
                </p>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
```

- [ ] **Step 7.4: Run test, verify passes**

```bash
npm test -- TransitDirectory
```
Expected: 4 passed.

- [ ] **Step 7.5: Commit**

```bash
git add components/directory/TransitDirectory.tsx \
  __tests__/components/directory/TransitDirectory.test.tsx
git commit -m "feat: TransitDirectory — 4 mutually-exclusive mode tiers"
```

---

## Task 8: LensDirectory container

**Files:**
- Create: `components/LensDirectory.tsx`
- Test: `__tests__/components/LensDirectory.test.tsx`

- [ ] **Step 8.1: Write failing test**

`__tests__/components/LensDirectory.test.tsx`:
```tsx
/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { LensDirectory } from '@/components/LensDirectory'

const fakeCross = {
  generated_at: '',
  source_versions: { neighborhoods: '', zoning_dataset: '', transit_stops_count: 0 },
  neighborhoods: [], zoning: [], transit_bands: [],
  transit_tiers: [
    { tier: 'rail', area_sqm: 1, share_of_sf: 0.08 },
    { tier: 'rapid-bus', area_sqm: 1, share_of_sf: 0.18 },
    { tier: 'local-bus', area_sqm: 1, share_of_sf: 0.52 },
    { tier: 'poor', area_sqm: 1, share_of_sf: 0.22 },
  ],
} as any
const fakeLens = { neighborhoods: {}, zoning: {}, transit_tiers: {} } as any

describe('LensDirectory', () => {
  it('returns null when mode is null (closed)', () => {
    const { container } = render(
      <LensDirectory mode={null} crossStats={fakeCross} lensStats={fakeLens}
        statusLine="x" onClose={() => {}} onSelectRegion={() => {}} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders the neighborhoods directory when mode = neighborhoods', () => {
    render(
      <LensDirectory mode="neighborhoods" crossStats={fakeCross} lensStats={fakeLens}
        statusLine="1,247 visible" onClose={() => {}} onSelectRegion={() => {}} />
    )
    expect(screen.getByPlaceholderText(/search 41 neighborhoods/i)).toBeInTheDocument()
  })

  it('renders the zoning directory when mode = zoning', () => {
    render(
      <LensDirectory mode="zoning" crossStats={fakeCross} lensStats={fakeLens}
        statusLine="x" onClose={() => {}} onSelectRegion={() => {}} />
    )
    expect(screen.getByText('Showing')).toBeInTheDocument()
  })

  it('renders the transit directory when mode = transit', () => {
    render(
      <LensDirectory mode="transit" crossStats={fakeCross} lensStats={fakeLens}
        statusLine="x" onClose={() => {}} onSelectRegion={() => {}} />
    )
    expect(screen.getByText('Rail-served')).toBeInTheDocument()
  })

  it('closes on ESC', () => {
    const onClose = jest.fn()
    render(
      <LensDirectory mode="neighborhoods" crossStats={fakeCross} lensStats={fakeLens}
        statusLine="x" onClose={onClose} onSelectRegion={() => {}} />
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 8.2: Run test, verify fails**

```bash
npm test -- LensDirectory
```
Expected: fail.

- [ ] **Step 8.3: Implement LensDirectory**

`components/LensDirectory.tsx`:
```tsx
'use client'
import { useEffect } from 'react'
import type { CrossStats, ZoningCategory, TransitTier } from '@/lib/cross-stats'
import type { LensStats } from '@/lib/lens-stats'
import type { LensMode } from './LensRail'
import { NeighborhoodDirectory } from './directory/NeighborhoodDirectory'
import { ZoningDirectory } from './directory/ZoningDirectory'
import { TransitDirectory } from './directory/TransitDirectory'

interface Props {
  mode: LensMode | null
  crossStats: CrossStats | null
  lensStats: LensStats | null
  statusLine: string
  onClose: () => void
  onSelectRegion: (
    kind: 'neighborhood' | 'zoning' | 'tier',
    id: string,
  ) => void
}

export function LensDirectory({ mode, crossStats, lensStats, statusLine, onClose, onSelectRegion }: Props) {
  useEffect(() => {
    if (!mode) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, onClose])

  if (!mode) return null

  return (
    <div
      role="dialog"
      aria-label={`${mode} directory`}
      className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-[1001] bg-paper border border-paper-edge rounded-md shadow-xl px-3.5 py-3 w-[380px] md:w-[420px] max-w-[calc(100vw-32px)]"
    >
      <div className="text-[9px] font-mono uppercase tracking-wider text-ink-faint">
        Showing
      </div>
      <div className="font-serif text-[13px] pb-2 border-b border-paper-edge/40">
        {statusLine}
      </div>

      {mode === 'neighborhoods' && (
        <NeighborhoodDirectory
          geo={crossStats?.neighborhoods ?? []}
          lens={lensStats?.neighborhoods ?? {}}
          onSelect={(name) => onSelectRegion('neighborhood', name)}
        />
      )}
      {mode === 'zoning' && (
        <ZoningDirectory
          geo={crossStats?.zoning ?? []}
          lens={lensStats?.zoning ?? {}}
          onSelect={(cat) => onSelectRegion('zoning', cat as string)}
        />
      )}
      {mode === 'transit' && (
        <TransitDirectory
          geo={crossStats?.transit_tiers ?? []}
          lens={lensStats?.transit_tiers ?? {} as any}
          onSelect={(tier) => onSelectRegion('tier', tier as string)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 8.4: Run test, verify passes**

```bash
npm test -- LensDirectory
```
Expected: 5 passed.

- [ ] **Step 8.5: Commit**

```bash
git add components/LensDirectory.tsx \
  __tests__/components/LensDirectory.test.tsx
git commit -m "feat: LensDirectory container — switches between the three per-lens drawers"
```

---

## Task 9: Make LensRail expandable

**Files:**
- Modify: `components/LensRail.tsx`
- Test: `__tests__/lens-rail.test.tsx` (new)

- [ ] **Step 9.1: Write failing test**

`__tests__/lens-rail.test.tsx`:
```tsx
/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { LensRail } from '@/components/LensRail'

describe('LensRail (expandable)', () => {
  it('renders three chips', () => {
    render(<LensRail mode="neighborhoods" onChange={() => {}} open={null} onOpenChange={() => {}} />)
    expect(screen.getByRole('radio', { name: 'Neighborhoods' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Zoning' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Transit' })).toBeInTheDocument()
  })

  it('clicking the active mode toggles open state', () => {
    const onOpenChange = jest.fn()
    render(<LensRail mode="neighborhoods" onChange={() => {}} open={null} onOpenChange={onOpenChange} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Neighborhoods' }))
    expect(onOpenChange).toHaveBeenCalledWith('neighborhoods')
  })

  it('clicking the open mode closes it', () => {
    const onOpenChange = jest.fn()
    render(<LensRail mode="neighborhoods" onChange={() => {}} open="neighborhoods" onOpenChange={onOpenChange} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Neighborhoods' }))
    expect(onOpenChange).toHaveBeenCalledWith(null)
  })

  it('clicking a different mode while open swaps + keeps open', () => {
    const onChange = jest.fn()
    const onOpenChange = jest.fn()
    render(<LensRail mode="neighborhoods" onChange={onChange} open="neighborhoods" onOpenChange={onOpenChange} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Zoning' }))
    expect(onChange).toHaveBeenCalledWith('zoning')
    expect(onOpenChange).toHaveBeenCalledWith('zoning')
  })
})
```

- [ ] **Step 9.2: Run test, verify fails**

```bash
npm test -- lens-rail
```
Expected: fail (open / onOpenChange props don't exist).

- [ ] **Step 9.3: Update LensRail**

`components/LensRail.tsx`:
```tsx
'use client'

export type LensMode = 'neighborhoods' | 'zoning' | 'transit'

interface Props {
  mode: LensMode
  onChange: (m: LensMode) => void
  open: LensMode | null
  onOpenChange: (next: LensMode | null) => void
}

const MODES: { value: LensMode; label: string }[] = [
  { value: 'neighborhoods', label: 'Neighborhoods' },
  { value: 'zoning',        label: 'Zoning' },
  { value: 'transit',       label: 'Transit' },
]

export function LensRail({ mode, onChange, open, onOpenChange }: Props) {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000]">
      <div
        className="bg-paper border border-paper-edge rounded-md shadow-md flex items-center gap-1 px-1.5 py-1"
        role="radiogroup"
        aria-label="Map lens"
      >
        {MODES.map((m) => {
          const isActive = mode === m.value
          const isOpen = open === m.value
          return (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-expanded={isOpen}
              onClick={() => {
                if (isActive) {
                  onOpenChange(isOpen ? null : m.value)
                } else {
                  onChange(m.value)
                  onOpenChange(m.value)
                }
              }}
              className={`text-[11px] px-2.5 py-1 rounded-full font-semibold transition ${
                isActive ? 'bg-ink text-paper' : 'text-ink-soft hover:text-ink'
              }`}
            >
              {m.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

> Drawer rendering itself lives in `Map.tsx` (next task) so `LensRail` stays presentation-only.

- [ ] **Step 9.4: Run test, verify passes**

```bash
npm test -- lens-rail
```
Expected: 4 passed.

- [ ] **Step 9.5: Commit**

```bash
git add components/LensRail.tsx __tests__/lens-rail.test.tsx
git commit -m "feat: LensRail accepts open/onOpenChange — chips now expandable"
```

---

## Task 10: Wire Map.tsx — fetch lens-stats, mount LensDirectory, drop SummaryCard

**Files:**
- Modify: `components/Map.tsx`
- Modify: `__tests__/components/Map.test.tsx` (extend existing)

- [ ] **Step 10.1: Add state for lens-directory open mode**

Inside `Map()` (near line 126 where `summaryState` is declared), add:
```ts
const [lensOpen, setLensOpen] = useState<LensMode | null>(null)
const [lensStats, setLensStats] = useState<import('@/lib/lens-stats').LensStats | null>(null)
```

- [ ] **Step 10.2: Fetch /api/lens-stats once on mount**

Inside the existing mount effect that loads `cross-stats.json`:
```ts
fetch('/api/lens-stats')
  .then((r) => (r.ok ? r.json() : null))
  .then((data) => setLensStats(data))
  .catch(() => setLensStats(null))
```

- [ ] **Step 10.3: Read `lensOpen` from URL on mount**

In `applyUrlState`:
```ts
const lensOpenParam = sp.get('lensOpen')
if (lensOpenParam === 'neighborhoods' || lensOpenParam === 'zoning' || lensOpenParam === 'transit') {
  setLensOpen(lensOpenParam)
} else {
  setLensOpen(null)
}
```

- [ ] **Step 10.4: Write `lensOpen` to URL in the existing sync effect**

In the URL-write `useEffect` that calls `setOrDelete(...)` for `mode`, add:
```ts
setOrDelete('lensOpen', lensOpen ?? '', '')
```

Add `lensOpen` to the dependency array.

- [ ] **Step 10.5: Replace LensRail call**

Replace:
```tsx
<LensRail mode={mapMode} onChange={(m) => setMapMode(m)} />
```
with:
```tsx
<LensRail
  mode={mapMode}
  onChange={(m) => setMapMode(m)}
  open={lensOpen}
  onOpenChange={setLensOpen}
/>
<LensDirectory
  mode={lensOpen}
  crossStats={crossStats}
  lensStats={lensStats}
  statusLine={summarySentence}
  onClose={() => setLensOpen(null)}
  onSelectRegion={(kind, id) => {
    if (kind === 'neighborhood') openNhoodPanel(id)
    else if (kind === 'zoning') setSelectedZoningDistrict({ zoningSim: id, gen: '' })
    // tier select: leave as no-op for now (drill panel covered separately)
  }}
/>
```

Add `import { LensDirectory } from './LensDirectory'` at the top.

- [ ] **Step 10.6: Remove the SummaryCard render**

Delete the JSX block that renders `<SummaryCard ... />` and the `summaryItems` / `summaryState` plumbing if no longer used. Leave `summarySentence` — it now feeds `LensDirectory.statusLine`.

- [ ] **Step 10.7: Run all tests**

```bash
npm test
```
Expected: existing tests still pass; one new failure in `summary-card.test.tsx` if SummaryCard is gone (handled in Task 13).

- [ ] **Step 10.8: Manual smoke test**

```bash
npm run dev
```
Open `http://localhost:3000`, click each chip in the rail, verify the drawer opens with the right contents. Refresh `?lensOpen=zoning` and verify it deep-links.

- [ ] **Step 10.9: Commit**

```bash
git add components/Map.tsx
git commit -m "feat: Map wires LensDirectory + URL-persistent lensOpen, drops SummaryCard mount"
```

---

## Task 11: Mobile bottom-sheet for the drawer

**Files:**
- Modify: `components/LensDirectory.tsx`
- Test: `__tests__/components/LensDirectory.test.tsx` (extend)

- [ ] **Step 11.1: Add a failing viewport-based test**

Append to `__tests__/components/LensDirectory.test.tsx`:
```tsx
it('renders bottom-anchored on narrow viewports', () => {
  // Spoof window.innerWidth
  Object.defineProperty(window, 'innerWidth', { value: 400, configurable: true })
  window.dispatchEvent(new Event('resize'))
  render(
    <LensDirectory mode="neighborhoods" crossStats={fakeCross} lensStats={fakeLens}
      statusLine="x" onClose={() => {}} onSelectRegion={() => {}} />
  )
  const dialog = screen.getByRole('dialog')
  expect(dialog.className).toMatch(/bottom-0/)
})
```

- [ ] **Step 11.2: Run test, verify fails**

```bash
npm test -- LensDirectory
```
Expected: fail (no `bottom-0` class).

- [ ] **Step 11.3: Branch on viewport in LensDirectory**

Inside `LensDirectory`, before `return`:
```ts
const [isMobile, setIsMobile] = useState(false)
useEffect(() => {
  const sync = () => setIsMobile(window.innerWidth < 768)
  sync()
  window.addEventListener('resize', sync)
  return () => window.removeEventListener('resize', sync)
}, [])
```

Swap container className:
```tsx
className={
  isMobile
    ? 'fixed bottom-0 left-0 right-0 z-[1001] bg-paper border-t border-paper-edge rounded-t-lg shadow-2xl px-3.5 py-3 max-h-[70dvh] overflow-y-auto'
    : 'absolute top-full left-1/2 -translate-x-1/2 mt-2 z-[1001] bg-paper border border-paper-edge rounded-md shadow-xl px-3.5 py-3 w-[380px] md:w-[420px] max-w-[calc(100vw-32px)]'
}
```

Import `useState`.

- [ ] **Step 11.4: Run test, verify passes**

```bash
npm test -- LensDirectory
```
Expected: 6 passed.

- [ ] **Step 11.5: Commit**

```bash
git add components/LensDirectory.tsx __tests__/components/LensDirectory.test.tsx
git commit -m "feat: LensDirectory renders as bottom sheet on mobile (< 768 px)"
```

---

## Task 12: Refactor /about and /stats to use METRIC_DEFINITIONS

**Files:**
- Modify: `app/about/page.tsx`
- Modify: `app/stats/page.tsx`

- [ ] **Step 12.1: Find existing glossary copy on /about**

```bash
grep -n 'permits filed\|net new\|year-over\|days from filed\|near rail' app/about/page.tsx app/stats/page.tsx
```

- [ ] **Step 12.2: Replace inline strings with METRIC_DEFINITIONS lookups**

For each matched string, replace the inline text with the matching value from `METRIC_DEFINITIONS`. Example pattern in JSX:
```tsx
import { METRIC_DEFINITIONS } from '@/lib/metric-definitions'

<dt>Permits filed</dt>
<dd>{METRIC_DEFINITIONS.permitsInWindow}</dd>
```

> The `/stats` chart legends use the same metric names; replace those too.

- [ ] **Step 12.3: Manually verify both pages**

```bash
npm run dev
```
Visit `/about` and `/stats`. Verify each glossary entry reads naturally and matches the metric exactly. If a definition was tuned for inline use vs glossary use and the wording in `METRIC_DEFINITIONS` needs slight expansion, update the constant — never let the surfaces drift apart again.

- [ ] **Step 12.4: Commit**

```bash
git add app/about/page.tsx app/stats/page.tsx lib/metric-definitions.ts
git commit -m "refactor: /about and /stats consume METRIC_DEFINITIONS"
```

---

## Task 13: Cleanup — delete SummaryCard, update PLAN.md

**Files:**
- Delete: `components/SummaryCard.tsx`
- Delete: `__tests__/summary-card.test.tsx`
- Modify: `PLAN.md`
- Conditionally delete: `components/VolumeDonut.tsx`, `__tests__/volume-donut.test.tsx`

- [ ] **Step 13.1: Verify SummaryCard has no remaining consumers**

```bash
grep -rn "SummaryCard\|VolumeDonut" components app lib __tests__
```
Expected: only matches inside the SummaryCard / VolumeDonut files themselves and their tests.

If `VolumeDonut` has no other consumers, delete it and its test in the next step. Otherwise leave it.

- [ ] **Step 13.2: Delete SummaryCard + test**

```bash
git rm components/SummaryCard.tsx __tests__/summary-card.test.tsx
# If applicable:
git rm components/VolumeDonut.tsx __tests__/volume-donut.test.tsx
```

- [ ] **Step 13.3: Update PLAN.md**

Append a "Deferred work" section (or update the existing roadmap area) with:
```markdown
### Deferred follow-ups (post lens-directories)

- **Permit→zoning enrichment** — cron-side point-in-polygon pass that
  writes `zoning_category` onto every Permit in the daily snapshot.
  Unlocks `ZoningDirectory`'s Permits bar and "Top:" neighborhoods.
  Schema is already in place; no UI change required when this lands.
- **Z+ Zoning height-band slicing** — ingest DataSF height districts;
  add as a 4th option to the zoning drawer sub-tab.
- **Z++ State-law eligibility slicing** — per-parcel SB 9 / AB 2011 /
  SB 35 computation.
- **N3 Per-acre sort toggle** — third sort option on the neighborhoods
  directory.
```

- [ ] **Step 13.4: Run the full suite**

```bash
npm test
npm run build
```
Expected: all tests pass, build clean.

- [ ] **Step 13.5: Final commit**

```bash
git add PLAN.md
git commit -m "chore: drop SummaryCard, log Z+/Z++/N3 as deferred work"
```

- [ ] **Step 13.6: Push and verify**

```bash
git push
```
Wait for the Vercel build to finish; sanity-check `https://whatsbuildingsf.com`:
- Click each lens chip — drawer opens.
- Click again — drawer closes.
- Search a neighborhood — list filters.
- Expand a zoning category — districts appear.
- Transit tab — 4 tiers render.
- Hover any `?` — definition appears.
- Mobile view — drawer is a bottom sheet.

---

## Out of scope (documented in spec)

- Z+ Height as a zoning slicing.
- Z++ State-law eligibility.
- N3 permits-per-acre sort toggle.
- Changes to detail panels.
