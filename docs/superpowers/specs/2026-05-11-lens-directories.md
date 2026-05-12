# 2026-05-11 — Lens directories: per-lens drawers inside the chip rail

Follow-up to `2026-05-11-ui-rethink-design.md`. That spec landed the
top-right `SummaryCard` as the "browse all" surface. Use surfaced two
problems:

1. The card and the lens rail are two corner widgets doing related work
   ("which lens?" and "what's in this lens?"). One surface beats two.
2. The card's contents are a generic ranked list across all three lenses,
   but the data shape differs per lens — uniform layout produces
   mismatched meaning. Zoning rows currently show `land share %`, transit
   rows show individual stations (which the overlay doesn't visualize),
   neighborhood rows show permit counts. The donuts mean different things
   in different lenses.

This spec replaces the SummaryCard with a lens-rail drawer: clicking a
chip in the rail expands the directory directly below it, and each lens
gets its own native layout because zoning, transit, and neighborhoods
don't have the same shape. Transit also gets recut to mode tiers
(rail-served / rapid-bus only / local-bus only / transit-poor) and drops
the 1-mile band entirely.

## Vocabulary

Terms used throughout this spec (and going forward in code review):

- **Lens** — one of the three top-level choices (Neighborhoods / Zoning
  / Transit). Owns the map overlay.
- **Region** — an individual item inside a lens (a neighborhood, a
  zoning category, a transit tier).
- **Directory** — the per-lens list of regions that opens when a chip is
  clicked. Replaces the SummaryCard.
- **Detail panel** — the deep-dive card for one specific region or one
  permit. Existing components; unchanged by this spec.

## Goals

1. One surface for picking a lens and exploring its regions.
2. Each lens's directory matches the geometry of its data.
3. Tooltipped definitions for every metric, sourced from one place.
4. Transit tells the rail-rich vs bus-only vs transit-poor story.

## Decisions

- **B + C combined.** The lens chip rail expands downward into a drawer.
  Each lens gets its own native layout inside the drawer. The
  top-right `SummaryCard` is removed.
- **Zoning Z2 — drill-down.** Five general categories visible. Click any
  row to expand its specific districts (RH-1 / RH-2 / RM-1 / NCT-3 etc.)
  inline.
- **Neighborhoods N1 + N2.** Each row shows: zoning-mix bar · homes
  added · YoY % · days-to-permit · % near rail. Every metric has a `?`
  tooltip backed by a shared `METRIC_DEFINITIONS` map. Default sort is
  permits ↓; toggle for A–Z. Search field above the list.
- **Transit T1 — mode tiers.** Four mutually exclusive tiers:
  rail-served, rapid-bus only, local-bus only, transit-poor. All at the
  same ¼-mi walking distance. Sums to 100% of SF.
- **Future (not in this spec):** Z+ Height as a 4th zoning slicing, Z++
  State-law eligibility, N3 permits-per-acre sort. Folded into
  `PLAN.md`.

## Out of scope

- Z+ Height bands (needs DataSF height-districts ingestion).
- Z++ State-law eligibility (SB 9 / AB 2011 / SB 35 per-parcel
  computation).
- N3 permits-per-acre sort toggle.
- Changes to detail panels themselves — those keep their current chrome
  (`LensInfoPanel`).
- Mobile-specific layout polish beyond bottom-sheet fallback.

---

## 1. Chrome changes

### 1a. LensRail becomes expandable

`components/LensRail.tsx` today is a three-pill switch pinned top-center.
After this spec it gains an "open" state for each chip.

- Click `Neighborhoods` — chip toggles open, drawer expands below it.
- Click `Neighborhoods` again — drawer collapses.
- Click `Zoning` while `Neighborhoods` is open — drawer stays open,
  contents swap to Zoning.
- Click outside the drawer — drawer collapses.
- ESC — drawer collapses.

The drawer floats below the rail (350–420 px wide on desktop), uses
paper-cream background to distinguish from the ink rail, and never
covers more than ~60% of viewport height (`max-h-[60dvh]` with internal
scroll).

URL persistence: `?lens=zoning&lensOpen=1` so a shared link can deep-link
into the open state. Default open state on first load: closed.

### 1b. SummaryCard removed

`components/SummaryCard.tsx` and its `summaryItems` / `summaryState`
plumbing in `components/Map.tsx` come out. The status sentence
("1,247 visible · housing, last year") moves to the top of the open
drawer as a single line under the eyebrow.

### 1c. Mobile

On viewports < 768 px the drawer renders as a bottom sheet (anchored
bottom, full-width, drag-to-dismiss) instead of a top-center drop. The
chip rail itself stays top-center.

---

## 2. Lens directories

### 2a. Neighborhoods directory

41 rows, scrollable, with sticky search + sort header.

Row contents (top to bottom):
- **Title row:** neighborhood name (left) + permit count `?` (right,
  sienna).
- **Meta strip:** five inline metrics separated by whitespace, each with
  a `?` tooltip:
  - **Mix** — 60-px-wide stacked bar of zoning categories within the
    nhood. Tooltip lists the breakdown ("Residential 54% · Mixed Use
    38% · Commercial 8%").
  - **Homes** — `+312 homes` — net new units across all matching
    permits.
  - **YoY** — `+18% YoY` (sage if up, sienna if down).
  - **Days** — `184 days` — median filed → permitted, last 12 months.
  - **Near rail** — `91% near rail` — % of nhood land within ¼ mi of
    rail or rapid bus.

Sort: `Permits ↓` (default) and `A–Z`. Visual = pill toggles in the
header.

Search: a single text input above the list, filters by name
case-insensitively.

Empty state (no nhoods match search): "No matches" + a clear-search
button.

Component: new `components/directory/NeighborhoodDirectory.tsx`.

### 2b. Zoning directory (Z2 drill-down)

Five rows, one per general category (Residential, Mixed Use, Commercial,
Industrial, Public).

Row contents:
- **Head:** swatch + category name + chevron (▸ closed, ▾ open).
- **Land bar:** % of SF land in this category. Bar uses the category
  color.
- **Permits bar:** % of *matching* permits in this category. Bar uses
  the sienna accent color.
- **Top neighborhoods:** "Top: Mission · SoMa · Hayes Valley" — top 3
  nhoods by permit count *within this category*.

Clicking the row toggles a drill-down panel showing the specific zoning
districts within the category. Districts come from the
`zoning_sim` (district code) and `districtna` (long name) properties of
the existing zoning GeoJSON, grouped by `gen`. Each drill-down row:
- District code (`RH-1`, `NCT-3`).
- Short description (one line).
- Land share within the category (% of category land, not % of SF).

Only one category can be expanded at a time.

Component: new `components/directory/ZoningDirectory.tsx`.

### 2c. Transit directory (T1 mode tiers)

Four rows, one per tier, displayed in this order (best to worst).
Each row is mutually exclusive — every parcel in SF belongs to exactly
one tier.

| Tier | Definition | Visual |
|---|---|---|
| Rail-served | within ¼ mi of BART · Muni Metro · Caltrain | navy "B" pill |
| Rapid-bus only | within ¼ mi of a Muni R-suffix line, **not also** rail-served | gold "R" square |
| Local-bus only | within ¼ mi of a frequent local Muni line (≥6 trips/hr peak), not rapid-bus or rail | cream circle, sienna outline |
| Transit-poor | none of the above within ¼ mi | empty placeholder |

Each row shows: tier label · single-line definition · stats
(`8% of SF · 412 permits · 1,840 homes`) · dominant zoning categories.

Component: new `components/directory/TransitDirectory.tsx`.

Replaces the per-station ranking the current `SummaryCard` shows in
transit mode.

---

## 3. Tooltips & shared definitions

New file: `lib/metric-definitions.ts`.

```ts
export const METRIC_DEFINITIONS = {
  permitsInWindow: 'Permits filed in the last 12 months matching current filters.',
  homesAdded: 'Net new dwelling units across all matching permits.',
  yoyChange: 'Year-over-year change in permit count vs the same window one year prior.',
  daysToPermit: 'Median days from filed → permitted, last 12 months.',
  nearRail: '% of land within ¼ mi of BART, Muni Metro, Caltrain, or a Muni rapid-bus line.',
  zoningMix: 'Distribution of zoning categories within this region by land area.',
  landShare: '% of SF land area in this category.',
  permitShare: '% of matching permits in this category.',
  // …
} as const
export type MetricKey = keyof typeof METRIC_DEFINITIONS
```

New component: `components/MetricHint.tsx`. Renders a small `?` chip; on
hover (desktop) or tap (mobile) shows a tooltip with the definition
text. Reads exclusively from `METRIC_DEFINITIONS`. Use sites:

- The five neighborhood-row metrics.
- The zoning bar labels (Land / Permits).
- The transit tier definitions.
- The /about page's metric glossary section (refactor to consume the
  same map).
- The /stats page's chart legends (refactor).

One source of truth — change a definition once, every surface updates.

---

## 4. Data & build script

### 4a. Data split: geometric vs temporal

Strict separation. Geometric data (built once from polygons, time-invariant)
stays in `cross-stats.json` at build time. Temporal data (depends on the
permit snapshot, refreshes daily) lives behind a new edge route.

**Geometric — `scripts/build-cross-stats.ts` → `public/cross-stats.json`:**

| Where | Field | Source |
|---|---|---|
| `neighborhoods[]` | `area_sqm`, `zoning_mix` (already exists) | nhood × zoning intersect |
| `neighborhoods[]` | `near_rail_pct` (new) | nhood × rail-served tier polygon |
| `zoning[]` | `land_share` (already exists) | gen-category union area / SF area |
| `zoning[]` | `districts[]` (new) — `{ code, name, description, land_share_within_cat }` | grouped by `gen` from zoning GeoJSON |
| `transit_tiers[]` (new) | `{ tier, land_share }` per tier | rail / rapid-bus-only / local-bus-only / poor polygons |

**Temporal — new edge route `app/api/lens-stats/route.ts` (daily-cached):**

| Where | Field | Source |
|---|---|---|
| `neighborhoods[name]` | `permits_12mo` | count of matching permits |
| `neighborhoods[name]` | `homes_added_12mo` | `sum(net_units)` |
| `neighborhoods[name]` | `yoy_pct` | 12mo vs prior 12mo |
| `neighborhoods[name]` | `median_days_to_permit` | median(`issued` − `filed`) over permits where issued |
| `zoning[cat]` | `permits_share` | matching permits in category / total |
| `zoning[cat]` | `top_neighborhoods` (top 3) | nhoods ranked by permit count *within this category* |
| `transit_tiers[tier]` | `permits`, `homes`, `dominant_zoning` | aggregate over permits whose parcel is in this tier polygon |

The frontend fetches `/cross-stats.json` and `/api/lens-stats` once on
map mount and joins them client-side by region key. Both are cacheable
(cross-stats forever, lens-stats 24 h).

Pre-compute the tier polygons in the same build script and emit
`public/transit-tiers.geojson` for the overlay; they're geometric.

### 4b. Transit tier classification

New constant in `lib/transit.ts`:

```ts
export type TransitTier = 'rail' | 'rapid-bus' | 'local-bus' | 'poor'
export const RAPID_BUS_LINES = ['5R', '7R', '9R', '14R', '38R', '49']
export const FREQUENT_LOCAL_LINES = ['1', '14', '22', '24', '30', '38', /* … */]
export function classifyParcel(coords: [number, number]): TransitTier { /* … */ }
```

For build-time tier areas (used in the directory's
`land_share` columns), pre-compute exclusive polygons:

- `rail-served` polygon = union of 400 m buffers around rail stops
- `rapid-bus-only` polygon = union of 400 m buffers around rapid-bus
  stops, *minus* `rail-served`
- `local-bus-only` polygon = union of 400 m buffers around frequent
  local stops, *minus* the above two
- `transit-poor` polygon = SF outline minus the three above

Add these to `scripts/build-cross-stats.ts` and `public/transit-tiers.geojson`.

Frequent-local-bus stop list needs sourcing. Two options for the
implementation plan to pick:

1. Hand-curate from SFMTA's published Frequent Transit Network list —
   stable, small dataset, embed coordinates directly in `lib/transit.ts`
   like the existing rail-stop array.
2. Compute from SF Muni GTFS data — route_short_name where
   `frequency_minutes ≤ 10` in AM peak. More work, auto-updates.

Recommend (1) for this spec. The FTN is a planning-document concept
that doesn't churn day-to-day; static is fine. Add ~50 stop coordinates
to `lib/transit.ts` alongside the existing rail data.

The rapid-bus + frequent-local line names in the snippet above are
illustrative; the implementation plan settles the final list against
SFMTA's current FTN map.

---

## 5. Files affected

### New

- `components/LensDirectory.tsx` — drawer container, owns open/close state.
- `components/directory/NeighborhoodDirectory.tsx` — N1+N2 list.
- `components/directory/ZoningDirectory.tsx` — Z2 drill-down.
- `components/directory/TransitDirectory.tsx` — T1 mode tiers.
- `components/MetricHint.tsx` — `?` tooltip primitive.
- `lib/metric-definitions.ts` — `METRIC_DEFINITIONS` map.
- `app/api/lens-stats/route.ts` — edge route, daily-cached.
- `public/transit-tiers.geojson` — pre-computed tier polygons (build
  script output).
- Tests: `__tests__/components/MetricHint.test.tsx`,
  `__tests__/components/directory/*.test.tsx`,
  `__tests__/api/lens-stats.test.ts`.

### Updated

- `components/LensRail.tsx` — gain an `open: LensMode | null` prop,
  render the drawer below.
- `components/Map.tsx` — drop SummaryCard wiring; pass lens-stats /
  cross-stats to the rail; wire the URL persistence.
- `scripts/build-cross-stats.ts` — emit the new transit-tier polygons
  and per-category top-neighborhood / districts data.
- `lib/cross-stats.ts` — type additions for the new shape.
- `lib/transit.ts` — `TransitTier` type, `classifyParcel`,
  frequent-local-line list.
- `app/about/page.tsx` and `app/stats/page.tsx` — refactor metric
  glossary / chart legends to consume `METRIC_DEFINITIONS`.

### Removed

- `components/SummaryCard.tsx`.
- `components/VolumeDonut.tsx` if no other consumer remains (verify).

---

## 6. Acceptance

- `SummaryCard` and its imports no longer exist.
- Clicking a chip in the LensRail expands a drawer; clicking again
  collapses it; clicking a different chip swaps contents.
- The Neighborhoods directory renders all 41 with search, sort, and the
  five metrics per row.
- The Zoning directory renders all 5 categories with drill-down
  expansion to specific districts.
- The Transit directory renders 4 mutually-exclusive tiers; tier land
  shares sum to ~100% (allow ≤ 1% rounding error).
- Every metric has a `?` tooltip whose text comes from
  `METRIC_DEFINITIONS`. `/about` and `/stats` consume the same map.
- URL `?lens=zoning&lensOpen=1` deep-links into the open state.
- Mobile (< 768 px): drawer renders as a bottom sheet.
- All tests pass. Existing test count (104) grows by ~15 (the new
  directory + tier + tooltip tests).
- Live on `whatsbuildingsf.com`.

## Future work (logged in PLAN.md)

- **Z+ Height** — ingest DataSF height districts; add as the fourth
  zoning slicing.
- **Z++ State-law eligibility** — per-parcel SB 9 / AB 2011 / SB 35
  computation; add as the fifth zoning slicing.
- **N3 permits-per-acre sort** — third sort option in the neighborhoods
  directory header.
