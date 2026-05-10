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
- New backend services. All work fits in the existing Next.js + Vercel +
  Upstash + nightly-cron stack.
- Property Information Map (PIM) parity. We surface a subset of zoning
  fields, not the full code section per district.

## Data sources

Pull from real datasets wherever a dataset exists. Hand-curate only the
fields no dataset publishes. Each source is fetched once per night by a
new build step in `scripts/build-cross-stats.ts`; outputs land in
`/public/*.json` as static assets.

| Concern | Source | Form | Refresh |
|---|---|---|---|
| Zoning polygons + `zoning_sim` + `gen` + `codesection` | DataSF `3i4a-hu95` | Socrata REST | nightly (already wired) |
| Height & bulk per district | DataSF `h9wh-cg3m` (`gen_hght`, `height` strings like "240-S") | Socrata REST | nightly (new) |
| Muni rail + bus stops | DataSF `i28k-bkz6` (Muni Stops) joined with `9exe-acju` (Muni Routes) | Socrata REST | nightly (new) |
| BART stations | BART GTFS `stops.txt` from `bart.gov/schedules/developers/gtfs` | GTFS zip, no key | nightly (new) |
| Caltrain stations (SF only) | Caltrain GTFS via 511 regional feed, hand-filtered to 3 SF stops | GTFS zip + key | nightly (new) |
| Zoning rules table (FAR, density, uses, parking, setbacks, lot coverage) | **No SF dataset exists.** Hand-curated `lib/zoning-rules.ts` keyed by `zoning_sim`. Source-of-truth: SF Planning Code Articles 2/7. | TS literal | manual (twice/year cadence) |
| State-law eligibility (SB-9 / AB-2011 / SB-35 / density bonus / ADU) | **No parcel-level dataset exists.** Derived from `zoning_sim` + heuristics. | derived | per build |

Things explicitly checked and ruled out:
- `srq6-hmpv` does not exist (404). No DataSF zoning-controls table.
- California's `data.ca.gov` SB-35 dataset is per-jurisdiction (one row
  for SF), refreshed annually — useless for parcel-level work.
- GTFS `route_type` does not distinguish strict BRT from regular bus
  (Van Ness BRT runs as routes 47/49 with `route_type=3` "Bus"; Geary
  Rapid runs as 38R, also `route_type=3`). Strict BRT classification is
  not derivable from GTFS — see §3a for the rapid-bus alternative we
  use instead.

---

## 1. Zoning rules + family-zoning impact

### 1a. Data model

Two layers: dataset-pulled fields and hand-curated fields. The merge
happens at build time in `scripts/build-cross-stats.ts`.

**Dataset-pulled (auto-refreshed nightly):**

- `zoning_sim`, `gen`, `name`, `codesection` — DataSF `3i4a-hu95`
  (already pulled today via `/api/zoning`).
- `height_ft`, `bulk_letter` — DataSF `h9wh-cg3m` (Height & Bulk
  Districts). The dataset's `height` field is a string like `"40-X"` or
  `"240-S"`; we split it into a numeric height (`gen_hght` is also
  available) and a bulk-control letter. Note this is keyed by
  height-and-bulk *polygon*, not by `zoning_sim` — we resolve via
  spatial join (centroid of each zoning polygon vs. height polygons,
  taking the dominant intersect). The result is height per zoning
  district, persisted into `/public/zoning-heights.json`.

**Hand-curated** (no dataset publishes these):

- FAR cap
- Density (units/lot for RH-* codes; DU/acre for RM/RC codes)
- Principal permitted uses
- Parking minimums
- Setbacks (front / rear / side)
- Lot coverage max %
- State-law eligibility flags

Source for hand-curated fields: SF Planning Code Articles 2 (residential),
7 (NCD), and the per-district Sec. 209 (RH/RM), 712 (NC), 803 (Mixed
Use), etc. Spot-check by sampling 5 codes against the published Code.

The `codesection` returned by DataSF gives the correct article/section
for each district, so the lookup workflow is: open `codesection` URL →
transcribe rule values into `lib/zoning-rules.ts`.

**Combined record** (built at runtime by merging dataset fetch with
hand-curated module):

```ts
interface ZoningRecord {
  // Dataset-derived
  code: string                     // 'RH-1' (from 3i4a-hu95)
  gen: ZoningCategory              // 'Residential' (from 3i4a-hu95)
  name: string                     // 'Residential, House — One Family'
  codesection: string              // (from 3i4a-hu95)
  height_ft: { min?: number; max: number; bulk?: string }  // from h9wh-cg3m

  // Hand-curated (lib/zoning-rules.ts)
  density: {
    units_per_lot?: number
    du_per_acre?: number
    note?: string
  }
  far?: { max: number; note?: string }
  principal_uses: string[]
  parking_min: { residential?: string; commercial?: string }
  setbacks?: { front_ft?: number; rear_ft?: number; side_ft?: number }
  lot_coverage_max_pct?: number
  family_laws: FamilyLawEligibility[]
}
```

Coverage target: every `zoning_sim` value present in the DataSF response
(~70–90 codes). Fields not applicable to a code are omitted rather than
zeroed.

Build-time validation in `scripts/build-cross-stats.ts`: every
`zoning_sim` from DataSF must have a matching hand-curated record, or
the build fails. Prevents new districts (post-Planning-Code amendment)
from silently rendering as blank panels.

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
| `Transit-adjacent: off`     | rail-only checkbox + rapid-bus-only checkbox |

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
- `transit` mode: the three rail bands plus the two new rapid-bus bands
  (see §3). Clicking a row selects the corresponding ring, same as
  clicking the ring on the map.

State: `browseOpen: boolean` hoisted into `Map.tsx`. Persisted in URL
as `?browse=1` so a deep link can include it.

### 2c. URL state additions

Existing keys stay (`stages`, `cats`, `minUnits`, `completedYears`,
`recentActivity`, `permit`, `nhood`). Added:

- `mode` — `neighborhoods` | `zoning` | `transit` (default
  `neighborhoods`, omitted when default).
- `transit` — `rail` | `rapid-bus` | `both` | omitted when off.
- `station` — selected station id (slug) when present.
- `radius` — meters around the selected station (default 400m for rail,
  160m for rapid bus).
- `district` — selected `zoning_sim` (for `ZoningDistrictPanel` deep
  links).
- `browse` — `1` when the browse panel is open.

Encoding rules unchanged from today: omit if equal to default.

---

## 3. Transit expansion

### 3a. Stop list — built from datasets

`lib/transit.ts` is replaced by `lib/transit-stations.ts` exporting two
arrays loaded from JSON files emitted at build time:

```ts
interface RailStation {
  id: string                       // slug, e.g. 'bart-24th-mission'
  name: string
  lat: number
  lng: number
  modes: ('bart' | 'muni-metro' | 'caltrain')[]
}

interface RapidBusStop {
  id: string
  name: string
  lat: number
  lng: number
  routes: string[]                 // ['38R', '14R'] etc.
}

export const RAIL_STATIONS: RailStation[]   // from /public/rail-stations.json
export const RAPID_BUS_STOPS: RapidBusStop[] // from /public/rapid-bus-stops.json
```

Build-time fetch in `scripts/build-cross-stats.ts`:

**Rail stations** — `RAIL_STATIONS` is the union of three sources,
de-duplicated by proximity (<50m collapse to one station with merged
`modes`):

1. **BART** — fetch `https://www.bart.gov/dev/schedules/google_transit.zip`,
   parse `stops.txt`. Filter to stops within the SF Bay County polygon
   plus Daly City (since it serves SF's southern edge).
2. **Muni Metro** — DataSF Socrata query against `i28k-bkz6` (Muni
   Stops), joined to `9exe-acju` (Muni Routes) to filter `lineabbr` ∈
   {K, L, M, N, T, J}. The join key is `route_id` (Muni stops carry the
   routes they serve in `serviceplanningstoptype` or via the related
   stops-routes table).
3. **Caltrain** — fetch Caltrain GTFS via 511 regional feed
   (`api.511.org/transit/datafeeds?operator_id=CT&api_key={KEY}`), parse
   `stops.txt`, filter to the 3 SF stops by stop_id whitelist
   (`70011`, `70012`, `70021` — 4th & King / 22nd St / Bayshore).

**Rapid bus stops** — definition shifted from "strict BRT" to
*SFMTA's Rapid Network*, since strict BRT is not derivable from any
dataset. Pulled from DataSF `i28k-bkz6` joined to `9exe-acju`:

> Routes whose `lineabbr` ends in `R` (e.g. 5R, 9R, 14R, 38R), plus the
> 47 and 49 lines along the Van Ness BRT corridor.

This captures the SFMTA-defined "frequent rapid" network. Trade-off
acknowledged: it includes more lines than dictionary-strict BRT would,
but every stop in the set has a dataset row, so the list updates itself
when SFMTA modifies routes.

The 47 / 49 *along Van Ness BRT* are the only line-segments where we
add a hand-listed corridor filter — only stops between Mission and
Lombard count for the rapid-bus shed (rest of the line is regular bus
in mixed traffic). The corridor bounding box is in
`lib/transit-stations.ts` as a constant.

511 API key is provisioned via `process.env.FIVE_ELEVEN_API_KEY` (added
to `.env.local` and Vercel env). Rate limit is 60 req/hour; the build
fetches once per nightly run, well under the limit.

Build outputs cached files at:
- `/public/rail-stations.json`
- `/public/rapid-bus-stops.json`
- `/public/rail-rings.geojson`  (existing, regenerated)
- `/public/rapid-bus-rings.geojson`  (new)

### 3b. Distance bands

Two independent dimensions, computed by `scripts/build-cross-stats.ts`:

- **Rail shed**: ¼ mi (400m), ½ mi (800m), 1 mi (1600m). Existing.
- **Rapid-bus shed**: 0.1 mi (~160m), ¼ mi (400m). New.

Rationale: rapid-bus walk-sheds are conventionally tighter than rail —
the service is good but not as schedule-defining as BART/Caltrain.
Keeping the dimensions separate prevents the false equivalence of
"transit-adjacent" lumping a frequent-bus parcel with a BART-platform
parcel.

The build script emits `public/transit-rings.geojson` (existing) plus a
new `public/rapid-bus-rings.geojson`. The transit lens renders both
sets, with rapid-bus rings drawn in a distinct hue (sage / dusty gold)
differentiated from the existing burnt-sienna rail rings.

`isTransitAdjacent` becomes:

```ts
export function railShed(coords, threshold = 800): boolean
export function rapidBusShed(coords, threshold = 160): boolean
export function transitAdjacent(coords, opts: {
  rail?: boolean       // default true
  rapidBus?: boolean   // default false
  railThresholdM?: number
  rapidBusThresholdM?: number
}): boolean
```

The existing single `transitOnly` filter is replaced by two booleans in
`Map.tsx` state — `railOnly` and `rapidBusOnly` — both surfaced inside
the "Transit-adjacent" popover.

### 3c. Per-station filter via map click

Render station markers on the map when `mapMode === 'transit'`:

- Rail stations as small filled navy circles.
- Rapid-bus stops as small open navy squares.
- Tooltip on hover: station name + modes/routes.

New component `components/StationMarkers.tsx`. State lifts to `Map.tsx`:
`selectedStation: { kind: 'rail' | 'rapid-bus'; id: string } | null` and
`stationRadiusM: number`.

Clicking a station:

1. Sets `selectedStation`.
2. Renders a single circle ring around it at `stationRadiusM` (default
   400 for rail, 160 for rapid bus) using a new variant of
   `TransitRings`.
3. Filters visible permits to those within the radius (in addition to
   any other active filters).
4. Opens a small `LensInfoPanel` (reusing the existing component) with:
   - Station name + modes/routes
   - Permit count in the radius
   - Top zoning categories in the radius
   - A radius slider matching the global bands: 400 / 800 / 1600m for
     rail; 160 / 400m for rapid bus.

Click anywhere off the station, or the panel close button, clears the
selection.

### 3d. Cross-stats output

`scripts/build-cross-stats.ts` extension:

- Emit `transit_bands_rapid_bus` alongside the existing `transit_bands`
  (rail).
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
- `__tests__/transit-stations.test.ts` — `railShed` and
  `rapidBusShed` boundary tests at the threshold; verify Caltrain
  stations and Rapid Network stops are matched. Mock the build-time
  fetches with fixture JSON so tests don't hit DataSF or 511.
- `__tests__/clustering.test.ts` — render `Map` at z 13 with mock permits;
  assert cluster bubbles appear and individual pins do not.

The existing `lib/transit.test.ts` is renamed and updated to cover the
new dual-shed API.

---

## 6. Migration & rollout

Each item ships independently behind no feature flag — they're additive
and non-breaking from the user's perspective. Suggested merge order:

1. **Build-pipeline plumbing** — extend `scripts/build-cross-stats.ts`
   to fetch from `h9wh-cg3m`, `i28k-bkz6`, `9exe-acju`, BART GTFS, and
   Caltrain GTFS. Add `FIVE_ELEVEN_API_KEY` to `.env.local` and Vercel
   env. Emit the new JSON/GeoJSON outputs into `/public`. No UI yet.
2. Transit data + dual-shed (consumes #1).
3. Zoning rules (hand-curated module + `h9wh-cg3m` heights merge) +
   family-zoning module + new district panel.
4. Filter popovers + browse panel.
5. Clustering wiring.

Order minimizes merge conflicts: each later slice touches `Map.tsx`
state and `FilterPanel` props, so doing the most invasive (filter UI)
late lets the others stabilize first.

The existing URL parameters keep working unchanged. New parameters
(`mode`, `transit`, `station`, `radius`, `district`, `browse`) are
additive and default to the current behavior when omitted.

## Open questions

None blocking. Decisions captured upstream in this document.
