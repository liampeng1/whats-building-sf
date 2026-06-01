# Frequency-driven transit tiers + per-stop detail — design

Date: 2026-05-31
Branch: `transit-bus-frequency-data`

## Goal

Wire the new per-stop Muni frequency dataset (`public/muni-stop-frequency.json`,
built earlier on this branch) into the transit lens UI. Two outcomes:

1. **Make the tiers real.** Replace the current tier definition — which rests
   on a hardcoded 7-line "frequent local" list and name-based rapid (`R`)
   detection — with measured service frequency, and expand the model from 4
   categories to **5 frequency bands**.
2. **Add a per-stop detail layer.** Let a user click a Muni stop and see the
   routes serving it with peak and off-peak headways.

The dataset already exists and is validated (3,170 stops, 59 routes, peak +
off-peak trips/hr per route per stop). This spec covers only the UI/model and
build-pipeline changes that consume it.

## Context: the merged tier work

`main` (HEAD `5105c99`) already contains a "transit-tier page rethink"
(branch `transit-access-heat-layer`, now merged):

- `components/TransitTierOverlay.tsx` — a heat layer coloring SF by tier.
- `components/TransitTierPanel.tsx` — per-tier detail (disparity headline →
  use mix → pipeline by stage → recent permits).
- `components/directory/TransitDirectory.tsx` — drawer legend of the tiers.
- `lib/transit-tiers-style.ts` — single source of truth for tier order,
  labels, colors, heat opacity.
- `lib/transit-tier-insight.ts`, `lib/lens-stats.ts` — per-tier rollups.

All of it is built on the 4-tier model and the `classifyTier()` function. This
spec changes that model and the classifier underneath, reusing the merged
presentation chrome.

## Section 0 — Prerequisite: rebase onto main

The current branch `transit-bus-frequency-data` is based on `932d85f` and does
**not** contain the merged tier work. First action: bring the branch up to
`main` so all changes below target the merged structure. Resolve the trivial
overlap (both added to `build-cross-stats.ts` and `lib/transit-stations.ts`).

## Section 1 — Tier model: 4 → 5 frequency bands

Canonical type lives in `lib/transit-stations.ts`, re-exported by
`lib/cross-stats.ts`:

```
'rail' | 'rapid-bus' | 'local-bus' | 'poor'
  →  'rail' | 'very-frequent-bus' | 'frequent-bus' | 'basic-bus' | 'poor'
```

Band definitions (peak trips/hr at the nearest stop — see Section 2):

| Tier               | Definition                                  |
|--------------------|---------------------------------------------|
| `rail`             | within ¼ mi of BART / Muni Metro / Caltrain |
| `very-frequent-bus`| ≥ 12 combined peak tph (≤ ~5 min)           |
| `frequent-bus`     | ≥ 6 combined peak tph (≤ ~10 min)           |
| `basic-bus`        | ≥ 2 combined peak tph (≤ ~30 min)           |
| `poor`             | no rail, < 2 peak tph                        |

Changing the type surfaces every `Record<TransitTier, …>` as a TypeScript
error, making the change exhaustive rather than guesswork. Sites to update:

- `lib/transit-stations.ts` — type + `classifyTier` (Section 2)
- `lib/transit-tiers-style.ts` — `TIER_ORDER`, `TIER_LABELS`, `TIER_COLORS`,
  `TIER_BASE_OPACITY`
- `lib/transit-tier-insight.ts` — `ZERO_BY_TIER`
- `lib/lens-stats.ts` — `transit_tiers` record + tier loop
- `lib/metric-definitions.ts` — per-tier definition strings + `DEF_KEY`
- `components/TransitTierPanel.tsx` — `DEF_KEY`
- `components/directory/TransitDirectory.tsx` — legend
- `components/Map.tsx`, `components/FilterSheet.tsx` — tier typing / filter chips
- `app/about/page.tsx` — any tier copy

### Labels & colors

Labels: `Rail-served`, `Very frequent bus`, `Frequent bus`, `Basic bus`,
`Transit-poor`.

Colors — sequential ramp reusing the existing palette:

```
rail               #1c2438  navy
very-frequent-bus  #9a4a31  sienna
frequent-bus       #c08552  amber
basic-bus          #7d9b76  sage
poor               #a8a29e  taupe
```

Heat `TIER_BASE_OPACITY`: strongest access darkest, poor barely tints — e.g.
rail 0.42, very-frequent 0.38, frequent 0.30, basic 0.20, poor 0.10
(`tierFillOpacity` selection logic unchanged).

## Section 2 — Frequency-driven `classifyTier()`

`loadStations()` additionally fetches `/muni-stop-frequency.json` into a new
`FREQ_STOPS: FreqStop[]` array (same hydration pattern as the existing arrays).

For each stop precompute a **combined bus peak frequency**:

```
combinedBusPeakTph(stop) = sum of route.peakTph
                           for routes where route.mode === 'bus'
```

Muni Metro routes are excluded (covered by the rail tier); cable cars are
excluded per scope.

```
classifyTier(coords):
  if !coords                              → 'poor'
  if railShed(coords, 400m)               → 'rail'
  maxTph = max( combinedBusPeakTph(s) for s in FREQ_STOPS
                within 400m of coords ),  default 0
  maxTph ≥ 12 → 'very-frequent-bus'
  maxTph ≥ 6  → 'frequent-bus'
  maxTph ≥ 2  → 'basic-bus'
  else        → 'poor'
```

### Modeling knob

Combined-sum can overstate frequency where routes at a shared stop diverge
(different directions). This is the single tunable choice; it is isolated in
one function (`combinedBusPeakTph`) so switching to "best single route" is a
one-line change. Thresholds (12 / 6 / 2) live as named constants.

### Performance

3,170 stops × many permits is more work than today's ~960 stations. Add a
lightweight uniform **grid-bucket index** over `FREQ_STOPS` (cell ≈ the 400 m
shed) so `classifyTier` examines only stops in the neighboring cells. A unit
test asserts grid results equal brute-force results on a fixture.

## Section 3 — Build pipeline (heat-layer polygons)

`scripts/build-cross-stats.ts` builds `transit-tiers.geojson` today from
rail/rapid/local buffer unions differenced into 4 tiers. Replace the bus
buffers with **frequency-band buffers**:

1. Load the frequency stops (already produced earlier in the same build).
2. Bucket stops into the three bands by `combinedBusPeakTph` (≥12, ≥6, ≥2).
3. Buffer + union each band at ¼ mi.
4. Difference into 5 mutually-exclusive polygons, in precedence order:
   rail → very-frequent → frequent → basic → poor (poor = SF outline minus
   the union of the others).

`cross-stats.json` tier stats and `lens-stats` recompute through the new
`classifyTier`. The band-bucketing helper is pure and unit-tested.

`rapid-bus-stops.json` and `frequent-local-stops.json` are no longer used by
the tier model. Keep generating them for now (avoids breaking the existing
`StationMarkers` rapid-bus dots until Section 4 replaces them); mark as
removable in a follow-up.

## Section 4 — Per-stop detail layer (additive)

- **Markers.** `StationMarkers.tsx` renders frequency-stop dots at zoom ≥ 14,
  colored by the stop's band (same ramp as Section 1). Rail station markers
  unchanged.
- **Panel.** New `components/StopFrequencyPanel.tsx`, built on the existing
  `LensInfoPanel` chrome (as `TransitTierPanel` is). Shows the stop name and a
  per-route list: each route's short name, a mode chip, and **peak / off-peak
  headway** derived as `60 / tph` (e.g. `38R — 6 min peak / 6 min midday`;
  "peak only" when off-peak tph is 0). Routes sorted by peak frequency.
- **Wiring.** Reuse the `selectedStation` state pattern in `Map.tsx`; add a
  `kind: 'freq-stop'` branch that opens `StopFrequencyPanel`.

Headway formatting is a pure helper (`headwayLabel(tph)`), unit-tested.

## Section 5 — Testing (TDD)

- `classifyTier`: each band boundary (1.9 / 2 / 5.9 / 6 / 11.9 / 12 tph) and
  rail precedence over a high-frequency bus stop.
- Grid index: equality with brute-force classification on a fixture.
- `combinedBusPeakTph`: excludes Metro and cable-car routes; sums bus routes.
- `transit-tiers-style`: all 5 keys present in every record; opacities ordered.
- `transit-tier-insight`: `ZERO_BY_TIER` and rollups cover 5 tiers.
- Build band-bucketing: a stop lands in the correct band.
- `headwayLabel`: tph → minutes, "peak only" for 0 off-peak, rounding.
- `StopFrequencyPanel`: renders routes, formats headways, sorts by frequency.
- Update the merged tier tests (`TransitTierPanel`, `TransitDirectory`,
  `lens-stats`, `transit-tiers-style`) for the new keys/labels.

## Out of scope

- Removing `rapid-bus-stops.json` / `frequent-local-stops.json` (follow-up).
- Off-peak-based tiering (classification uses peak tph; off-peak shows only in
  the per-stop panel).
- Weekend/owl service tiers.
- Changes to the corridor lines (`TransitCorridors.tsx`) and its mode enum.
