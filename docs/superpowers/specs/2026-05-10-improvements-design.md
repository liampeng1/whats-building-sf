# 2026-05-10 — Improvements: zoning rules, filter UI, transit expansion, clustering

Follow-up improvements to the four pre-launch items already shipped. Each
section below names the user-visible problem, the design, and the data /
file changes it requires.

## Goals

1. Zoning lens explains *what can be built* on a parcel, not just the
   broad gen-category color, and shows how state family-zoning laws change
   the answer.
2. Filter panel separates active filters from the browse list of options.
3. Transit lens distinguishes rail-shed from bus-shed proximity, covers
   more of the actual SF transit network, and supports filtering relative
   to a specific station.
4. Clusters fill the visual gap between the city-wide choropleth and the
   parcel-level pins.

## Out of scope

- Per-parcel zoning compliance calculations (height/setback math against a
  specific lot's geometry). District-level rules only.
- Live GTFS pipelines. Stop lists stay hand-curated.
- New backend services. All work fits in the existing Next.js + Vercel +
  Upstash + nightly-cron stack.
- Property Information Map (PIM) parity. We surface a subset of zoning
  fields, not the full code section per district.

---

## 1. Zoning rules + family-zoning impact

### 1a. Data model

New module `lib/zoning-rules.ts` — a hand-curated lookup keyed by
`zoning_sim` (the per-district code returned by DataSF `3i4a-hu95`, e.g.
`RH-1`, `RM-2`, `NCT-3`, `C-3-O`, `PDR-1-G`). Each record:

```ts
interface ZoningRules {
  code: string                     // 'RH-1'
  gen: ZoningCategory              // 'Residential'
  name: string                     // 'Residential, House — One Family'
  height_ft: { min?: number; max: number }
  density: {
    units_per_lot?: number         // RH-1 = 1, RH-2 = 2, RH-3 = 3
    du_per_acre?: number           // for RM/RC codes
    note?: string                  // free-form when neither applies
  }
  far?: { max: number; note?: string }
  principal_uses: string[]         // ['single-family dwelling', 'ADU', ...]
  parking_min: { residential?: string; commercial?: string }  // narrative
  setbacks?: { front_ft?: number; rear_ft?: number; side_ft?: number }
  lot_coverage_max_pct?: number
  family_laws: FamilyLawEligibility[]
  source: { article: string; section: string }   // e.g. 'Article 2 §209'
}
```

Coverage target: every `zoning_sim` value present in the DataSF response
(~70–90 codes). Fields not applicable to a code are omitted rather than
zeroed.

Spot-check by sampling 10 codes against the SF Planning Code in
`Article 2`. The `codesectio` field already returned by the DataSF
response gives us the correct article / section to verify against.

### 1b. Family-zoning law module

New module `lib/family-zoning.ts`. Pure functions, no fetches.

```ts
type FamilyLaw = 'SB-9' | 'AB-2011' | 'SB-35' | 'density-bonus' | 'ADU'

interface FamilyLawEligibility {
  law: FamilyLaw
  applies: boolean
  uplift_summary: string  // 'Allows up to 4 units per lot via lot split + ADU'
}

export function eligibleLaws(zoningSim: string): FamilyLawEligibility[]
export function permitLawHeuristic(
  permit: Permit,
  zoningSim: string | null,
): { law: FamilyLaw; confidence: 'likely' | 'possible' }[]
```

District eligibility rules (encoded in `zoning-rules.ts.family_laws`):

- **SB-9**: applies to single-family-only zones (RH-1). Uplift: 1 → up to
  4 units via duplex + lot split + ADU.
- **AB-2011**: commercial corridors zoned for office/retail along certain
  classifications (NC-*, C-2 with frontage on arterials). Uplift:
  by-right residential.
- **SB-35**: any residential or mixed-use district where SF is below RHNA
  targets (currently all of SF). Uplift: streamlined ministerial review.
- **Density bonus**: any RH/RM/NCT district. Uplift: % unit increase in
  exchange for affordability.
- **ADU**: every residential district. Uplift: 1–2 ADUs allowed.

Per-permit heuristic (best-effort flag, displayed with confidence):

| Signal                                                       | Flag                |
|--------------------------------------------------------------|---------------------|
| `gen=Residential` AND `zoning_sim=RH-1` AND delta in [1..3]  | SB-9 likely         |
| `gen=Commercial`/`Mixed Use` AND proposed_use contains 'residential' | AB-2011 likely |
| Permit metadata mentions density-bonus / state-density-bonus | density-bonus likely|
| ADU / accessory dwelling in proposed_use                     | ADU likely          |
| Otherwise eligible district + new units                      | corresponding law possible |

Confidence is intentionally coarse — we are not the regulator, and the
permit data does not contain explicit law citations in most cases.

### 1c. UI

Replace `ZoningCategoryPanel` (which is keyed on `gen`) with
`ZoningDistrictPanel` (keyed on `zoning_sim`). Trigger: click on a
zoning polygon while in the `zoning` lens.

Panel structure (top to bottom):

1. **Header** — district code (e.g. `NCT-3`), full name, code section
   link.
2. **Hero summary** — height, density, FAR, parking minimum. Each as a
   small stat card.
3. **What can be built** — bulleted principal uses.
4. **State-law uplift story** — for each eligible `FamilyLaw`, a row:
   ```
   SB-9 ✓   1 unit baseline → up to 4 units
            via lot split + duplex + ADU.
   ```
   Reads as the "before/after" story per district.
5. **Recent permits in this district** — list of permits in the current
   filtered set whose nearest zoning polygon is this district. Each row
   shows the `permitLawHeuristic` flags as small badges.
6. **More details** (collapsible) — setbacks, lot coverage,
   conditional-use carve-outs.

Per-permit cross-reference — on `PermitDetailContent` (the in-panel and
standalone permit page), add a small section under the existing badges:

```
State-law context
SB-9 likely · ADU possible
```

Tooltip on each badge explains the heuristic ("Triggered because zoning
is RH-1 and the project adds 2 units"). One line, no doctrine.

### 1d. Cross-stats addition

`scripts/build-cross-stats.ts` already emits per-district breakdowns by
`gen`. Extend to emit a per-`zoning_sim` rollup — counts of permits per
district code in the current dataset — so the new panel's "recent
permits" list does not require a per-open scan.

---

## 2. Filter UI separation

### 2a. Popovers per filter section

Today's `FilterPanel` shows every filter section's options inline. We
collapse each section to a chip-trigger; the chip's label summarizes the
current value. Click → popover with the option chips that exist today.

| Trigger label example       | Opens popover containing                |
|-----------------------------|------------------------------------------|
| `Use: housing + commercial` | the existing CategoryChip grid          |
| `Stages: 3 of 5`            | the existing StageChip grid + definitions|
| `Min: 5+ homes`             | MIN_UNITS_OPTIONS buttons               |
| `Recent: last 2 years`      | RECENT_ACTIVITY_OPTIONS buttons         |
| `Completed: within 2y`      | COMPLETED_YEARS_OPTIONS buttons         |
| `Transit-adjacent: off`     | rail-only checkbox + BRT-only checkbox  |

A new component `components/FilterPopover.tsx` handles positioning
(absolute, anchored to the trigger via a ref) and keyboard dismissal
(Esc, click-outside). No third-party library — these are simple anchored
panels and the project has avoided floating-ui to date.

Only one popover open at a time. State: `openFilter: string | null`
hoisted into `FilterPanel`.

The header (logo, summary sentence, lifecycle key) and the
`MapModeSwitch` segmented control stay where they are — they're not
filter chrome.

### 2b. Browse panel

Extract the current `SectionList` (the long list of all neighborhoods /
zoning categories / transit bands) into a sibling component
`components/BrowsePanel.tsx`. It mounts as its own card in the
top-left, mirroring the FilterPanel's top-right placement. Closed by
default; opens via a small "Browse all" button on the FilterPanel.

Contents follow the active map mode, exactly as today, but with more
breathing room since it no longer competes with the filters for vertical
space:

- `neighborhoods` mode: all 41 neighborhoods, sorted by permit count
  descending, with the existing transit-coverage chip and permit-count
  bar.
- `zoning` mode: all `gen` categories, with land share + transit
  coverage. Clicking a row opens the same `ZoningCategoryPanel` that a
  polygon click opens today (behavior parity, just a second entry point).
- `transit` mode: the three rail bands plus the two new BRT bands (see
  §3). Clicking a row selects the corresponding ring, same as clicking
  the ring on the map.

State: `browseOpen: boolean` hoisted into `Map.tsx`. Persisted in URL
as `?browse=1` so a deep link can include it.

### 2c. URL state additions

Existing keys stay (`stages`, `cats`, `minUnits`, `completedYears`,
`recentActivity`, `permit`, `nhood`). Added:

- `mode` — `neighborhoods` | `zoning` | `transit` (default
  `neighborhoods`, omitted when default).
- `transit` — `rail` | `brt` | `both` | omitted when off.
- `station` — selected station id (slug) when present.
- `radius` — meters around the selected station (default 400m for rail,
  160m for BRT).
- `district` — selected `zoning_sim` (for `ZoningDistrictPanel` deep
  links).
- `browse` — `1` when the browse panel is open.

Encoding rules unchanged from today: omit if equal to default.

---

## 3. Transit expansion

### 3a. Stop list

`lib/transit.ts` is replaced by `lib/transit-stations.ts` with two
exported arrays:

```ts
interface TransitStation {
  id: string                       // slug, e.g. 'bart-24th-mission'
  name: string
  lat: number
  lng: number
  modes: ('bart' | 'muni-metro' | 'caltrain')[]   // for RAIL_STOPS
}

interface BrtStation {
  id: string
  name: string
  lat: number
  lng: number
  corridor: 'van-ness' | 'geary'
}

export const RAIL_STATIONS: TransitStation[]
export const BRT_STATIONS: BrtStation[]
```

`RAIL_STATIONS` includes:

- All 9 SF + Daly City BART stations (already present).
- Every Muni Metro station + surface stop on K, L, M, N, T, J — sourced
  from SFMTA's published stop lists. Deduplicated where modes share a
  platform (e.g. Castro = K/L/M).
- Three SF Caltrain stations: 4th & King, 22nd Street, Bayshore.

`BRT_STATIONS` includes:

- Van Ness BRT: every dedicated-lane station along Van Ness Ave between
  Mission and Lombard.
- Geary Rapid: limited-stop platforms along Geary between Market and
  33rd Ave (treating as BRT-equivalent for shed purposes).

Approximate coordinates (within ~50m) are adequate — we are computing
walk-shed membership, not routing.

### 3b. Distance bands

Two independent dimensions, computed by `scripts/build-cross-stats.ts`:

- **Rail shed**: ¼ mi (400m), ½ mi (800m), 1 mi (1600m). Existing.
- **BRT shed**: ⅛ mi (~160m, 0.1 mi), ¼ mi (400m). New.

Rationale: BRT walk-sheds are conventionally tighter than rail because
the level-of-service gap to walking alternatives is smaller. Keeping
the dimensions separate prevents the false equivalence of "transit-
adjacent" lumping a frequent-bus parcel with a BART-platform parcel.

The build script emits `public/transit-rings.geojson` (existing) plus a
new `public/brt-rings.geojson`. The choropleth/transit lens renders both
sets, with BRT rings drawn in a distinct hue (sage / gold differentiated
from the existing burnt-sienna rail rings).

`isTransitAdjacent` becomes:

```ts
export function railShed(coords, threshold = 800): boolean
export function brtShed(coords, threshold = 160): boolean
export function transitAdjacent(coords, opts: {
  rail?: boolean       // default true
  brt?: boolean        // default false
  railThresholdM?: number
  brtThresholdM?: number
}): boolean
```

The existing single `transitOnly` filter is replaced by two booleans in
`Map.tsx` state — `railOnly` and `brtOnly` — both surfaced inside the
"Transit-adjacent" popover.

### 3c. Per-station filter via map click

Render station markers on the map when `mapMode === 'transit'`:

- Rail stations as small filled navy circles.
- BRT stations as small open navy squares.
- Tooltip on hover: station name + modes.

New component `components/StationMarkers.tsx`. State lifts to `Map.tsx`:
`selectedStation: { kind: 'rail' | 'brt'; id: string } | null` and
`stationRadiusM: number`.

Clicking a station:

1. Sets `selectedStation`.
2. Renders a single circle ring around it at `stationRadiusM` (default
   400 for rail, 160 for BRT) using a new variant of `TransitRings`.
3. Filters visible permits to those within the radius (in addition to
   any other active filters).
4. Opens a small `LensInfoPanel` (reusing the existing component) with:
   - Station name + modes
   - Permit count in the radius
   - Top zoning categories in the radius
   - A radius slider matching the global bands: 400 / 800 / 1600m for
     rail; 160 / 400m for BRT.

Click anywhere off the station, or the panel close button, clears the
selection.

### 3d. Cross-stats output

`scripts/build-cross-stats.ts` extension:

- Emit `transit_bands_brt` alongside the existing `transit_bands`.
- Add `family_law_eligibility` per zoning category — a count of permits
  in eligible districts grouped by law, used for editorial copy.

---

## 4. High-level clustering

### 4a. Wiring

`react-leaflet-cluster` is already a dependency and `marker-cluster.css`
already styles cluster bubbles. Wire it up in `Map.tsx`:

```tsx
<MarkerClusterGroup
  chunkedLoading
  disableClusteringAtZoom={15}
  maxClusterRadius={60}
  spiderfyOnMaxZoom={false}
  showCoverageOnHover={false}
>
  <ZoomGatedPins ... />
</MarkerClusterGroup>
```

Behavior:

- z ≤ 11: choropleth dominates; clusters render but are visually quiet
  (cluster radius is large, counts low at this zoom).
- z 11–14: clusters carry the visualization. Each cluster shows a count
  in a thin navy ring (existing CSS).
- z 14–14.5: fade band — cluster opacity ramps down as pin opacity ramps
  up via the existing `--pin-opacity` CSS variable.
- z ≥ 15: clustering disabled; raw pins via `ZoomGatedPins`. Same as
  today.

### 4b. Pin opacity coordination

`pinOpacity()` already returns a 0–1 value across z 13.5–14.5. Add a
mirror `clusterOpacity()` that returns 1 below z 13.5, fading to 0 across
13.5–14.5. Apply via a `--cluster-opacity` CSS variable on the wrapper,
the same pattern as `--pin-opacity`. The cluster CSS picks it up via
inheritance.

### 4c. Cluster click

Default leaflet-cluster behavior is `zoomToBoundsOnClick` — fits the
viewport to the cluster's children. Keep that. Below z 15 a click "drills
in" until clustering disengages and individual pins appear.

### 4d. Performance

At full dataset size (~1800 permits) the existing `ZoomGatedPins` viewport
cull stays in place. Clustering is layered above it, not below — we only
cluster what's already in the viewport-culled set. With `chunkedLoading`
the cluster index builds in 50ms slices, avoiding the main-thread stall
that hits at first render.

---

## 5. Testing

New unit-test files:

- `__tests__/zoning-rules.test.ts` — every `zoning_sim` in
  `public/zoning.json` (snapshot or fixture) has a matching record in
  `lib/zoning-rules.ts`. Spot-check 5 known codes against expected
  height/density values.
- `__tests__/family-zoning.test.ts` — `permitLawHeuristic` fixtures
  covering each `FamilyLaw` enum and a "no laws apply" case.
- `__tests__/transit-stations.test.ts` — `railShed` and `brtShed`
  boundary tests at the threshold; verify Caltrain and Van Ness BRT
  stops are matched.
- `__tests__/clustering.test.ts` — render `Map` at z 13 with mock permits;
  assert cluster bubbles appear and individual pins do not.

The existing `lib/transit.test.ts` is renamed and updated to cover the
new dual-shed API.

---

## 6. Migration & rollout

Each item ships independently behind no feature flag — they're additive
and non-breaking from the user's perspective. Suggested merge order:

1. Transit data + dual-shed (foundation; `cross-stats` rebuild).
2. Zoning rules + family-zoning module + new district panel.
3. Filter popovers + browse panel.
4. Clustering wiring.

Order minimizes merge conflicts: each later slice touches `Map.tsx`
state and `FilterPanel` props, so doing the most invasive (filter UI)
late lets the others stabilize first.

The existing URL parameters keep working unchanged. New parameters
(`mode`, `transit`, `station`, `radius`, `district`, `browse`) are
additive and default to the current behavior when omitted.

## Open questions

None blocking. Decisions captured upstream in this document.
