# Per-neighborhood transit-tier breakdown — design

Date: 2026-05-31
Branch: `worktree-nhood-tier-breakdown` (worktree off origin/main)

## Goal

On the individual neighborhood view (the `NeighborhoodPanel`, which the
`/neighborhoods/[name]` route redirects into), show the share of that
neighborhood's land in each transit-access tier — Rail-served,
Rapid-bus only, Local-bus only, Transit-poor — replacing the current
0.1mi / ¼mi coverage-band rows.

## Data gap

Per-neighborhood records carry `transit_coverage` (bands) + `near_rail_pct`,
but no per-tier split. The four tier polygons are mutually exclusive and
clipped to the SF outline, so intersecting each neighborhood against them
yields a breakdown that sums to ≈1.

## Section 1 — Build pipeline (`scripts/build-cross-stats.ts`)

- **Hoist** the tier-polygon construction (`sfOutline` + the four clipped
  `tierFeatures` polys, currently built at ~L650–676) to **above** the
  per-neighborhood loop (~L460). It depends only on `railBuffer`,
  `rapidBuffer`, `localBuffer` (built earlier at ~L393) and `nhoodGeo`, so
  the move is safe. The later `transit_tiers` / `tiersCollection` code keeps
  consuming the same hoisted `tierFeatures`.
- In the per-neighborhood loop, intersect each neighborhood against each
  tier poly and emit:

  ```ts
  tier_share: Partial<Record<TransitTier, number>>  // share of nhood land
  ```

  Computed as `safeArea(intersect(nhood, tierPoly)) / totalArea` per tier;
  omit zero entries (matches how `zoning_share` is built).

## Section 2 — Type (`lib/cross-stats.ts`)

`NhoodStats` gains optional `tier_share?: Partial<Record<TransitTier, number>>`.
Optional so a stale `cross-stats.json` (pre-rebuild) still type-checks and
the panel can fall back.

## Section 3 — Render (`components/NeighborhoodPanel.tsx`)

`TransitAccessBlock` renders the 4-tier breakdown from `row.tier_share`,
reusing `TIER_ORDER`, `TIER_LABELS`, `TIER_COLORS` from
`lib/transit-tiers-style.ts` (single source of truth shared with the map
heat layer, directory legend, and tier panel). Same row markup it already
uses (label · percent · colored bar) plus a color dot per tier.

**Fallback:** if `row.tier_share` is absent/empty, render the existing
coverage-band rows unchanged — nothing breaks between deploy and rebuild.

## Section 4 — Rebuild data

Run the build script to regenerate `public/cross-stats.json` with the new
`tier_share` field. Spot-check that per-neighborhood tier shares sum to ≈1.

## Testing

- Unit (`__tests__/lib/cross-stats.test.ts`): a record carrying `tier_share`
  loads and the field round-trips; type allows omission.
- Component (`NeighborhoodPanel`): renders 4 tier rows + colors when
  `tier_share` present; falls back to bands when absent.
- Build correctness verified against the regenerated JSON (shares ≈1),
  consistent with how the existing turf-intersect blocks are trusted.

## Out of scope (YAGNI)

- No per-neighborhood permit/home tier splits (that's the tier panel).
- No change to the citywide tier directory, tier panel, or map layer.
- No new route; the `[name]` page keeps redirecting into the panel.
