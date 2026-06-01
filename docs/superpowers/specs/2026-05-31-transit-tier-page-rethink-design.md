# Transit-tier page rethink — design

Date: 2026-05-31
Branch: `transit-access-heat-layer`

## Goal

Turn the thin `TransitTierPanel` (today: land-share hero + a 2-row
permits/homes list) into a fuller page that **leads with an argument**
(is new housing following transit?) and then **profiles** the selected
tier: use mix, a pipeline-by-stage breakdown (permits + homes), and a
clickable recent-permits list.

## Panel sections (top → bottom)

1. **Disparity headline** — land% vs homes% + ratio
2. **Use mix** — colored bars by use category
3. **Pipeline by stage** — permits + net homes per stage, with totals
4. **Recent permits** — 5 most recent, clickable into `PermitPanel`

## Data sourcing (the important part)

Three of the four sections compute **client-side in `Map.tsx`** from the
already-loaded, already-filtered `filteredPermits`, classified into the
selected tier via `classifyTier(p.location.coordinates)`. This mirrors
the existing `StationPanel` shed pattern exactly. Sections 1, 3, 4 all
derive from this same client-side classification so the numbers are
internally consistent.

Section 2 (use mix) is added to the **lens-stats pipeline** as chosen:
an additive `use_mix` field on `TierLensStats`.

### Filter semantics
The client-side sections respect the active stage/category/min-units
filters (they read `filteredPermits`, not raw `permits`), so the panel
matches what's drawn on the map.

## Components & changes

### `lib/transit-tier-insight.ts` (new — pure, unit-tested)
```ts
// Share of net homes per tier, from the client-side tier classification.
homesShareByTier(permits, classify): Record<TransitTier, number>
// land% → homes% ratio. >1 building concentrates here, <1 lags. null if homesShare 0.
disparityRatio(landShare: number, homesShare: number): number | null
// Per-stage rollup for one tier.
stageBreakdown(permits, tier, classify): {
  rows: { stage: PermitStage; permits: number; homes: number }[]
  totalPermits: number
  totalHomes: number
}
```
- `homes` per permit = `max(0, netDelta(existing_units, proposed_units) ?? 0)`
  (floor at 0 so demolitions don't pull the homes column negative).
- Stage order from `STAGE_ORDER` minus `inactive` (matches app default).
- Stages with 0 permits are omitted from the rows.

### `lib/lens-stats.ts` (additive)
- `TierLensStats` gains `use_mix: Partial<Record<UseCategory, number>>`
  (share 0..1 per category within the tier).
- Computed in the existing `if (classifyTier)` tier loop using the
  enriched permit's `useCategory` field (already present on enriched
  permits), counted alongside `tierZoningCounts`, normalized after.
- Backward-compatible: field is optional; existing consumers unaffected.

### `components/Map.tsx` (wiring)
- Import `classifyTier` from `@/lib/transit-stations`.
- Compute `tierPermits = useMemo(() => selectedTier ? filteredPermits.filter(
  p => classifyTier(p.location?.coordinates) === selectedTier) : [])`.
- Compute `homesShare` for the selected tier via
  `homesShareByTier(filteredPermits, classifyTier)`.
- Pass `tierPermits`, `homesShare`, `onOpenPermit` into `TransitTierPanel`.

### `components/TransitTierPanel.tsx` (rebuild content; same `LensInfoPanel` chrome)
New props: `permits: Permit[]`, `homesShare: number`, `onOpenPermit: (id) => void`.
- **Hero**: keep land%, add `→ {homesShare}% of new homes` + ratio detail
  (e.g. "1.8× its share" / "0.3× — lags").
- **Use mix**: `use_mix` bars (reuse the directory `Bar`), colored per
  `USE_CATEGORY_LABELS`.
- **Pipeline by stage**: two-column (permits / homes) rows from
  `stageBreakdown`, stage dot from `STAGE_COLORS`, plus a totals row.
- **Recent permits**: top-5 by `status_date`, clickable rows (stage chip +
  address) → `onOpenPermit`, mirroring `StationPanel`.

## Testing

- `__tests__/lib/transit-tier-insight.test.ts` — homesShare sums to 1;
  ratio math + zero-homes → null; `stageBreakdown` groups/sums correctly,
  floors negative homes, omits empty stages, orders by `STAGE_ORDER`.
- Extend lens-stats coverage for `use_mix` normalization (new
  `__tests__/lib/lens-stats.test.ts`).
- `TransitTierPanel.test.tsx` — renders headline ratio, use-mix bars, a
  stage row with permits+homes, and a clickable permit row firing
  `onOpenPermit`.

## Out of scope (YAGNI)

- No new map interactions or pipeline rebuild beyond `use_mix`.
- No per-neighborhood drill-down inside the tier panel.
- `inactive`-stage permits already excluded by the default filter; not
  specially handled.
