# 2026-05-11 — UI rethink: zoom-gated chrome, station redesign, zoning context

Follows the four-improvements implementation (specs/2026-05-10) which surfaced
real chrome and visual problems in the browser. Direction A from the
mockups at `public/ui-mockups.html` was selected. This spec consolidates
the decisions and folds in the smaller follow-up calls — station icon style,
"outside of a zone" treatment, editorial context per district, and a height
reference visual.

Companion mockups (for reference during implementation):
- `public/ui-mockups.html` — the four overall directions
- `public/ui-mockups-stations.html` — four station treatments
- `public/ui-mockups-browse.html` — four "browse all" alternatives

## Goals

1. Map dominates at every zoom; chrome recedes until the user invokes it.
2. Transit lens reads as transit infrastructure, not a dot soup.
3. Browse data is discoverable without a separate popup.
4. Zoning panels become educational, not just regulatory.
5. Fix four bugs surfaced by the Playwright tour:
   - Station marker id collisions (React duplicate-key errors)
   - BART entrance / parent-station rows polluting the rail count
   - URL pollution on first paint
   - "Clusters never render" because `MarkerClusterGroup` wraps a zoom-gated component

## Out of scope

- New backend services. All work fits in the existing Next.js + Vercel +
  Upstash + nightly-cron stack.
- A native mobile app. The bottom-sheet pattern degrades acceptably on
  narrow viewports; full mobile pass is a follow-up.
- Replacing the choropleth aesthetic. Direction B (cluster-first, drop
  the choropleth) was considered and rejected — the choropleth is part
  of the site's editorial identity.

## Decisions captured

- **Overall direction:** A — zoom-gate aggressively. Chrome recedes; map dominates.
- **Station treatment:** S1 (tiered prominence) + dotted corridor lines.
- **Browse-all pattern:** B1 — top-right summary card grows into a top-N list, then expands to all.
- **Transit shed bands:** 0.1 mi (160 m) and 0.25 mi (400 m), uniform across rail + rapid bus.
- **Marker icon style:** glyph-based (Ⓑ / Ⓜ / small train silhouette / nothing on bus).
- **Outside-of-zone treatment:** hand-listed federal / special areas with editorial notes.
- **Zoning panel additions:** glossary tooltips, editorial blurb per gen, PIM link, "recent permits in this district" link, external-links footer, **height context visual**.

---

## 1. Chrome layout

Three persistent UI elements plus a bottom sheet on demand. All else is map.

### 1a. Top-right summary card (three states)

Anchored top-right. Has three click-through states:

1. **Collapsed (single line)** — `1,824 visible · Major projects, any use, last 2 years.`
2. **Top-5 (default on first load)** — collapsed-line content + a top-5 leaderboard for the active lens. Each row: name, count, small horizontal bar visualization. Bottom row: `See all 41 ↓` action.
3. **Expanded (all items)** — full scrollable list of all items in the active lens (41 neighborhoods / 5 zoning cats / 2 transit bands). Bottom row: `Show top 5 ↑` to return.

State cycling: tap the card body. URL gains `?list=top5|all|none` so deep-linkable. Default first-paint state is `top5`. Down-arrow / up-arrow icons signal expansion direction.

Switching the lens (via the rail or sheet) swaps what the card lists; state (`top5` / `all`) is preserved.

Component: replaces `BrowsePanel` + the existing summary line in `FilterPanel`. New file `components/SummaryCard.tsx`.

### 1b. Bottom-left lens rail

Three small inline pills: Neighborhoods / Zoning / Transit. Always visible. Switching the lens redraws the map and the top-right card.

Component: replaces `MapModeSwitch` (visually similar — three pills — but simplified and moved). Could keep the existing `MapModeSwitch.tsx` and just restyle / reposition.

### 1c. Bottom-right FAB

40 px navy circle, hamburger glyph. Tap opens the filter sheet (§4 below). When the sheet is open, the FAB swaps to a close X and the sheet's backdrop dims the map slightly.

Component: new `components/FilterFAB.tsx` (the button) + `components/FilterSheet.tsx` (the sheet body).

### 1d. Old chrome to delete

The following components are deleted as part of this work:
- `components/FilterPanel.tsx` — content moves to the sheet
- `components/FilterPopover.tsx` — no longer needed
- `components/BrowsePanel.tsx` — content moves into the summary card
- `components/MapModeSwitch.tsx` — may be reused for the lens rail; if simpler to start fresh, replace with `LensRail.tsx`

---

## 2. Map content by zoom

Behavior per lens at three zoom bands:

| Zoom | Neighborhoods | Zoning | Transit |
|---|---|---|---|
| ≤ 13 (city) | Choropleth tinted by permit count | Zoning polygons + special-area overlays | Dotted corridor lines (all modes) + BART, Muni Metro, Caltrain markers. No rapid-bus stops. |
| 13.5–14.5 (fade band) | Choropleth fades out; clusters fade in via `--cluster-opacity` / `--pin-opacity` CSS variables (existing pattern) | Polygons stay; clusters fade in | Lines + station markers stay; rapid-bus stops fade in; clusters fade in |
| ≥ 15 (close) | Raw pins | Polygons + raw pins | All stations as markers (BART big, Muni medium, Caltrain gold, rapid bus small) + raw pins |

Choropleth + zoning-polygons render via the existing `NeighborhoodChoropleth` + `ZoningOverlay` components. Clustering uses `react-leaflet-cluster` already wired (bug 4 below fixes the "never renders" issue).

---

## 3. Transit lens — markers, corridors, shed

### 3a. Station markers (S1, glyph-based)

Rendered when `mapMode === 'transit'`. Three classes:

- **BART** — 14 px navy filled circle with cream "Ⓑ" centered. Always visible in transit lens.
- **Muni Metro** — 12 px sage filled circle with cream "Ⓜ" centered. Always visible.
- **Caltrain** — 12 px gold square with a tiny stylized train silhouette in cream. Always visible.
- **Rapid bus** — 6 px open sienna dot, no glyph. Gated to zoom ≥ 14.

Hover (desktop) / long-press (mobile) → marker title shows station name + modes/routes. Click → opens the per-station panel (§3d).

Component: `components/StationMarkers.tsx` (exists; needs restyling — keep export).

### 3b. Corridor lines (new)

Rendered as dotted strokes when `mapMode === 'transit'`, at all zooms.

Geometry source: `shapes.txt` from each GTFS feed (BART, SFMTA, Caltrain via 511). New build step that fetches each agency's GTFS and emits a single merged `public/transit-corridors.geojson` with `LineString` features tagged:

```ts
type CorridorMode = 'bart' | 'muni-metro' | 'caltrain' | 'rapid-bus'
interface CorridorFeature {
  type: 'Feature'
  geometry: LineString | MultiLineString
  properties: {
    mode: CorridorMode
    line_name: string   // 'BART · Yellow', 'Muni · 38R', etc.
  }
}
```

Visual style per mode:
- BART: dotted, 2 px, navy
- Muni Metro: dotted, 2 px, sage
- Caltrain: dotted, 2 px, gold
- Rapid bus: dotted, 1.5 px, sienna, opacity 0.7

Dotted = `stroke-dasharray: 2 4` so the road network on the basemap (solid) stays visually distinct.

Components:
- `scripts/sources/transit-corridors.ts` — fetcher
- `components/TransitCorridors.tsx` — Leaflet GeoJSON render with mode-keyed styling
- Replace `components/TransitRings.tsx` — rings are dropped from the spec since we changed to the 0.1/0.25 model (the shed concept stays, but rings as a map layer go away).

### 3c. Transit shed (data, not a layer)

Two band widths, same for both modes:
- 0.1 mi (160 m)
- 0.25 mi (400 m)

`lib/transit-stations.ts`:

```ts
export const RAIL_THRESHOLD_M = 400        // ¼ mi
export const RAPID_BUS_THRESHOLD_M = 160   // 0.1 mi
```

Drop the old 800 m / 1600 m constants.

The shed is *not* rendered as a visible ring on the map at default zoom. It's used as a filter (the "transit-adjacent" sheet control, §4) and as the per-station radius (§3d).

### 3d. Per-station click + radius panel

Click a station marker → opens a small `StationPanel` (existing in `Map.tsx`). Body shows:
- Station name + modes/routes
- Permit count in radius
- Top zoning categories in radius (top 3)
- Radius selector: `160 m` / `400 m` (2 buttons, same for both kinds)
- Default radius on first click: 400 m for rail, 160 m for rapid bus

URL: `?station=<id>&radius=<m>` (existing keys).

### 3e. Cross-stats output

`scripts/build-cross-stats.ts` drops the 0.5 mi and 1 mi entries from `TRANSIT_BANDS`. Output `transit_bands` carries 0.1mi and 0.25mi only; `transit_bands_rapid_bus` likewise.

This is a breaking change to `cross-stats.json` shape — old `'0.5mi'` and `'1mi'` keys disappear. Consumers in this codebase: `lib/cross-stats.ts` types, the (now-deleted) `BrowsePanel`, and the new `SummaryCard` when in transit lens. All updated as part of this work.

---

## 4. Filter sheet

Opened by the bottom-right FAB. Slides up from the bottom, covers ~60% of viewport height on mobile, ~480 px max-width centered on desktop.

### Contents (top to bottom)

1. **Lens** — three pills (Neighborhoods / Zoning / Transit). Redundant with the bottom-left rail; included for thumb reach when the sheet is open.
2. **Use type** — existing CategoryChip grid + min-units row (housing-only)
3. **Lifecycle** — existing StageChip grid + completed-within row + "include cancelled" toggle
4. **Recent activity** — existing button group
5. **Transit-adjacent** — single segmented control: `Off · Rail · Rapid bus · Both`. Replaces the two separate checkboxes.

### Behavior

- Backdrop click closes
- Esc closes
- URL gains `?sheet=1` while open (deep-linkable)
- Slides up ~200 ms, slides down ~150 ms
- Filter changes apply immediately (no "Apply" button)
- Browse list does NOT live here — that's the summary card now

Component: `components/FilterSheet.tsx` (new).

---

## 5. Zoning panel additions

The existing `ZoningDistrictPanel` becomes more editorial. New surface area per district:

### 5a. Editorial blurb per `gen` category

A 1–2 sentence framing paragraph rendered at the top of the panel. Text is keyed by `gen` (not by `zoning_sim`), so there are 5–6 blurbs total. Sample:

- **Residential**: "Single-family and small-multi-unit zoning. About 38% of SF's land. State family-zoning laws (SB-9, ADU) most directly apply here."
- **Mixed Use**: "Commercial corridors that allow housing above ground-floor uses. Where most new infill happens in modern SF."
- **Commercial**: "Office and retail districts. C-3 covers downtown; lower-density C-2 covers neighborhood spines."
- **Industrial**: "Production / distribution / repair zones. Housing not permitted by right. Often the target of state by-right conversion bills."
- **Public**: "Public uses — parks, schools, civic buildings. Controls per §211."
- **Other**: "Special districts not in the standard zoning families. See district section."

Hand-curated in `lib/zoning-blurbs.ts`. ~6 entries.

### 5b. Glossary tooltips

Terms that get a hover/tap tooltip with a one-sentence definition:
- FAR
- Density
- Setback (front / rear / side)
- Lot coverage
- Principal use
- ADU
- Bulk control

`lib/zoning-glossary.ts` — keyed by term, returns `{ term, definition, source?: CodeCitation }`.

Render: any term used in the district panel that's in the glossary gets a subtle dotted underline. Hover → tooltip popover. The tooltip is a reusable `<Glossary term="FAR" />` component that wraps the underlined word.

### 5c. Height context visual

A small bar-chart visual on each district panel that places the district's allowed max height against named SF reference points.

#### Reference set (hand-coded)

`lib/sf-height-references.ts`:

```ts
interface HeightReference {
  name: string
  height_ft: number
  category: 'human' | 'residential' | 'civic' | 'tower'
  source: string   // citation URL or text
}

export const SF_HEIGHT_REFERENCES: HeightReference[] = [
  { name: 'Person',                  height_ft: 5.83, category: 'human' },
  { name: 'Typical floor',           height_ft: 10,   category: 'human' },
  { name: '3-story Victorian',       height_ft: 35,   category: 'residential' },
  { name: 'Painted Ladies',          height_ft: 40,   category: 'residential' },
  { name: 'Sentinel Building',       height_ft: 102,  category: 'civic' },
  { name: 'Coit Tower',              height_ft: 210,  category: 'civic' },
  { name: 'One Embarcadero Center',  height_ft: 568,  category: 'tower' },
  { name: '555 California',          height_ft: 779,  category: 'tower' },
  { name: 'Transamerica Pyramid',    height_ft: 853,  category: 'tower' },
  { name: 'Salesforce Tower',        height_ft: 1070, category: 'tower' },
]
```

Each entry carries a source citation (e.g. CTBUH or municipal record) added in the implementing PR. Spot-check 3 against Wikipedia.

#### Visual

A taller visual — ~280 px tall, full panel width. Each reference is rendered as a **hand-drawn SVG silhouette** at the right height, so the reader sees actual SF landmarks at scale, not just a list of numbers. Vertical scale is **linear within four "zoom bands"** (a break-axis pattern), not logarithmic — humans understand "twice as tall" better than log scale, and a logarithmic axis would make Salesforce Tower visually fit next to a person without conveying that it's 180× taller.

Layout (left-to-right):
1. Y-axis on the far left with foot labels at each band boundary
2. Center column: stacked silhouettes at their actual heights, with name labels
3. Right edge: a sienna highlighted band at the district's allowed height (e.g. RH-1 = 40 ft) running the full width with a `RH-1: 40 ft max` label

Break-axis bands (linear within each, scale jump between):
- 0–50 ft (covers Person, floor, Victorian, Painted Ladies)
- 50–250 ft (Sentinel, Coit Tower)
- 250–800 ft (One Embarcadero, 555 California, Transamerica)
- 800–1100 ft (Salesforce Tower)

A subtle horizontal break-line (`⤴` notation) separates the bands so the reader knows the axis isn't linear across the whole height.

References within ±20% of the district's allowed height get the **bold label** treatment — those are the most informative comparisons (e.g. for RH-1 at 40 ft, "3-story Victorian (35 ft)" and "Painted Ladies (40 ft)" both bolden).

When `height_ft` is unknown for a district (some special-district stubs), the visual is hidden; the panel falls back to "Height not specified for this district — see codesection."

#### Silhouette illustrations

Each reference has a hand-drawn SVG silhouette stored alongside its data:

```ts
interface HeightReference {
  name: string
  height_ft: number
  category: 'human' | 'residential' | 'civic' | 'tower'
  source: string
  illustration: string   // SVG path / inline SVG string
  width_px: number       // intrinsic width to scale by, alongside the height
}
```

Silhouettes are hand-drawn paths, not photographs, so they tile densely without overwhelming. Style: single-color (ink navy) silhouette, no gradient, no fill detail. Width-to-height ratio reflects reality (Salesforce Tower is narrow + tall; Painted Ladies row is wide + short).

The 10 silhouettes to draw:
- **Person** — simple stick figure or single-color silhouette
- **One floor** — a horizontal slice of building (rectangular outline with two windows)
- **3-story Victorian** — gable roof + bay window + porch (the prototypical SF row house)
- **Painted Ladies** — the iconic 6-house row (or one of them); short and wide
- **Sentinel Building** — distinctive copper-clad tapered tower at Columbus & Kearny
- **Coit Tower** — fluted Art Deco cylinder
- **One Embarcadero Center** — squat rectangular slab with rooftop detail
- **555 California** — bold dark monolith (BoA tower form)
- **Transamerica Pyramid** — instantly recognizable pyramid form
- **Salesforce Tower** — tapered glass spire

File organization:

- `lib/sf-height-references.ts` — the data array, including the inline SVG `<path>` for each silhouette
- Inline SVG paths (~50–150 chars each) keep everything in one file. No separate SVG asset directory needed; the silhouettes are simple enough to live as path strings.

Source for each silhouette: hand-traced from public-domain photographs. Each `source` field cites the photograph reference. (CTBUH database for tower heights; municipal records for civic structures.)

Component: `components/HeightContext.tsx`. Takes `{ height_ft: number; districtCode: string }`. Pure SVG + CSS, no external deps. Renders the break-axis chart + silhouettes inline.

### 5d. "View on PIM" link

Below the rules, a small external link:

```
  📍 View this district on SF Property Information Map ↗
```

Links to `https://sfplanninggis.org/pim/` (parameterless — the PIM doesn't support direct district URLs; user searches by parcel). Tooltip explains: "Authoritative planner-grade view of zoning, parcels, and overlays."

### 5e. "Recent permits in this district"

Computed count of permits currently in view whose resolved `zoning_sim` matches the district. Rendered as a chip-action: `12 permits in RH-1 currently visible →`. Click → applies `?district=RH-1` to the URL, which filters the map (existing wiring already supports the param).

### 5f. External links footer

Small section at the bottom of the panel:

```
  Sources:
  · SF Planning Code §209 ↗
  · CA Gov. Code §65852.21 (SB-9) ↗   [shown only when district is RH-1]
  · SF Planning Department zoning summaries ↗
```

The first link is the existing per-field citation. Family-law citations are pulled from the source comments in `lib/family-zoning.ts`. The summaries link points to a stable SF Planning published page.

---

## 6. "Outside SF zoning" areas

Federal land, state parks, and special-district overlays aren't in DataSF `3i4a-hu95`. We hand-list them as a small static overlay:

`lib/special-zoning-areas.ts`:

```ts
interface SpecialArea {
  name: string
  shape: Polygon | MultiPolygon     // approximate GeoJSON
  governor: string                  // 'Presidio Trust', 'National Park Service', etc.
  note: string                      // 1-line editorial
  source: { url: string; cite: string }
}

export const SPECIAL_ZONING_AREAS: SpecialArea[] = [
  { name: 'Presidio',               governor: 'Presidio Trust',          note: 'Federal land — not subject to SF Planning Code. Master plan controls.',                source: { url: 'https://www.presidio.gov/management/management-plans', cite: 'Presidio Trust' }, shape: /* hand-traced */ },
  { name: 'Golden Gate Recreation Area', governor: 'National Park Service', note: 'Federal park land — NPS general management plan controls.',                          source: { url: 'https://www.nps.gov/goga/', cite: 'NPS' },                                  shape: /* hand-traced */ },
  { name: 'Treasure Island / YBI',  governor: 'Treasure Island Development Authority (TIDA)', note: 'TI/YBI Development Plan — distinct from SF Planning Code.',         source: { url: 'https://sfgov.org/treasureisland/', cite: 'TIDA' },                       shape: /* hand-traced */ },
  // ~3–4 more, max
]
```

Geometry is hand-traced (low-fidelity GeoJSON, accurate to ~50 m) — these areas have no DataSF source so manual is the path. Saved as a TS literal, not a separate JSON file, so the citations stay collocated.

Render: thin diagonal-stripe pattern overlay (CSS pattern), visible only in zoning lens. Click → small `LensInfoPanel` with the name, governor, note, and source link. Doesn't replace the zoning panel — it's an alternative panel shape for these specific areas.

Component: `components/SpecialAreasOverlay.tsx` + reuses `LensInfoPanel`.

---

## 7. Bug fixes folded in

### 7a. Station id collisions

`scripts/sources/muni-stops.ts` generates `bus-${slugify(name)}` which collides for stops with identical names (e.g. opposite sides of an intersection). Fix:

```ts
id: `bus-${stopid}-${slugify(name)}`
```

Same change to the rail path: `muni-${stopid}-${slug}`. The dedupe-within-50m logic in `merge-rail.ts` still handles the cross-source same-station case (different stopids, same platform).

### 7b. BART `location_type` filter

Tighten the filter in `scripts/sources/bart-stations.ts` to only allow `location_type === '0'` (boarding stops). Drop the `location_type === ''` fallback (empty string was passing through entrance rows that omit the field). Same fix in `muni-stops.ts`'s `isValidStopRow`.

Apply the parent-station exclusion as a separate check: if `parent_station` field is present and non-empty, the row is a child stop, which is what we want. If `location_type === '1'` (parent), drop the row.

### 7c. URL pollution on first paint

In `components/Map.tsx`, the filter-sync `useEffect` runs on mount and writes default values to the URL. The `setOrDelete` default check compares against current state instead of module-level defaults. Fix:

```ts
const DEFAULTS = {
  stages: STAGE_ORDER.filter(s => s !== 'inactive').sort().join(','),
  cats: CATEGORIES.slice().sort().join(','),
  minUnits: '2',
  completedYears: '2',
  recentActivity: '24',
}

// in the effect:
setOrDelete('minUnits', String(minUnits), DEFAULTS.minUnits)
```

(Was already attempting this with literal defaults, but with the wrong default values — e.g. defaulted to `'0'` when state init is `2`.)

### 7d. Clusters never render

`MarkerClusterGroup` wraps `ZoomGatedPins` which returns `null` below `PIN_FADE_MIN` (z 13.5). With no children to cluster, no clusters appear. Fix: render `<PermitMarker>` children unconditionally inside the cluster group; let the cluster's `disableClusteringAtZoom={15}` + the existing `--pin-opacity` CSS variable handle the fade band.

Concretely:

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

Delete `ZoomGatedPins` (the wrapper is no longer needed). The CSS variable on individual pin DOM nodes still drives opacity for z 13.5–14.5; clusters render at all zooms < 15 automatically.

---

## 8. New data + build pipeline changes

### 8a. Transit corridors fetcher

`scripts/sources/transit-corridors.ts`:
- Fetches BART GTFS `shapes.txt` (already pulled in `bart-stations.ts` — reuse the zip), parses to LineStrings, tags `{ mode: 'bart' }`.
- Fetches SFMTA GTFS via 511, parses `shapes.txt`, joins to `routes.txt` to split into:
  - Muni Metro shapes (`route_short_name` in `{K, L, M, N, T, J}`) → `{ mode: 'muni-metro' }`
  - Rapid bus shapes (`route_short_name` ends with `R`) → `{ mode: 'rapid-bus' }`
- Fetches Caltrain GTFS via 511 — for the SF corridor, only the segment between the 4th & King, 22nd St, and Bayshore stops matters. Take the entire line (extends to San Jose); clip to SF county at render time via bbox (cheap), or trim at build time. Trim at build time for cleaner output.

Output: `public/transit-corridors.geojson` (single `FeatureCollection`).

### 8b. Cross-stats output

`scripts/build-cross-stats.ts`:
- `TRANSIT_BANDS = [0.1, 0.25]` (was `[0.25, 0.5, 1]`)
- `RAPID_BUS_BANDS = [0.1, 0.25]` (unchanged)
- The two ring sets now have identical band widths but separate computations (rail vs rapid bus shed differ in source stops).

### 8c. Old build outputs

- `public/transit-rings.geojson` — keep, but the data inside changes (drops `1mi` band)
- `public/rapid-bus-rings.geojson` — keep
- `public/cross-stats.json` — `transit_bands` and `transit_bands_rapid_bus` arrays both contain 2 entries now, not 3 + 2

Existing consumers in the codebase all get updated as part of this work.

---

## 9. URL params

All existing keys preserved. New / changed:

| Key | Values | Default | Purpose |
|---|---|---|---|
| `mode` | `neighborhoods` \| `zoning` \| `transit` | `neighborhoods` | unchanged |
| `sheet` | `1` \| omitted | omitted | Filter sheet open/closed |
| `list` | `top5` \| `all` \| `none` | `top5` | Summary card state |
| `transit` | `off` \| `rail` \| `rapid-bus` \| `both` | `off` | Sheet's transit-adjacent control |
| `station` | station id | omitted | unchanged |
| `radius` | meters | 400 (rail) / 160 (rapid-bus) | unchanged |
| `district` | `zoning_sim` | omitted | unchanged |
| `browse` | — | **removed** | replaced by `list` |
| permit/nhood/stages/cats/minUnits/completedYears/recentActivity | unchanged | | unchanged |

The popstate handler restores all of the above (existing helper from the previous round).

---

## 10. Testing

New unit tests:

- `__tests__/summary-card.test.tsx` — three-state cycle (none → top5 → all → top5); lens switch refreshes the list.
- `__tests__/filter-sheet.test.tsx` — open/close, backdrop click, Esc.
- `__tests__/transit-corridors.test.ts` — fixture-driven; verifies the line filtering for BART vs Muni vs rapid-bus, clip to SF bbox.
- `__tests__/height-context.test.tsx` — renders an SVG; asserts the district band lands in the right log-scale position; references render in order.
- `__tests__/special-areas.test.ts` — verifies each special-area record has required fields.
- `__tests__/zoning-glossary.test.ts` — every term has a definition + (when applicable) a citation.

Existing tests that need updates:
- `__tests__/transit-stations.test.ts` — `RAIL_THRESHOLD_M` is now 400 (not 800); add a case for the new station-id-collision pattern.
- `__tests__/muni-stops.test.ts` — id pattern is `bus-${stopid}-${slug}` not `bus-${slug}`.
- `__tests__/bart-stations.test.ts` — `location_type` filter tightened to `'0'` only.
- `__tests__/clustering.test.tsx` — `ZoomGatedPins` is gone; cluster wraps `PermitMarker` directly.

---

## 11. Migration order

Each phase is independently mergeable. Suggested:

1. **Bug fixes (no UI change)** — slug collisions, location_type tightening, URL pollution, cluster wrapping. Lands first; visible improvement at default zoom (clusters appear).
2. **Transit shed band collapse** — drop 0.5 mi / 1 mi from cross-stats; update `RAIL_THRESHOLD_M`. Smaller test change; data only.
3. **Transit corridors data + map render** — new fetcher, new `TransitCorridors` component, replace rings.
4. **Station marker restyle** — glyph-based S1; updated CSS in globals.
5. **Special-areas overlay** — `SPECIAL_ZONING_AREAS`, render in zoning lens.
6. **Zoning panel additions** — blurbs, glossary, height context, PIM link, recent-permits chip, external links footer.
7. **Chrome rewrite** — delete `FilterPanel` + `FilterPopover` + `BrowsePanel`; add `SummaryCard` (three-state) + `LensRail` + `FilterFAB` + `FilterSheet`.
8. **URL param migration** — `browse` → `list`; popstate handler updates.

Phases 1–6 are additive and don't break the existing chrome. Phase 7 is the cutover.

---

## 12. Open questions

None blocking. Decisions captured.
