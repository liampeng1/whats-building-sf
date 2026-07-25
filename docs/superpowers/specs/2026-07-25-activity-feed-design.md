# Latest Activity Feed — Design

**Date:** 2026-07-25
**Status:** Approved, ready for implementation plan

## Goal

Give people a reason to check the site and a way to see what changed. Surface
an ambient, city-wide discovery feed of recent construction activity — permits
just filed, just approved/issued, **construction just started**, and buildings
just completed — ranked so the interesting projects rise above the water-heater
noise.

This is the on-site, visual twin of the Atom feed we already ship at
`/feed.xml`, plus a compact homepage teaser.

## Decisions (locked)

- **Purpose:** ambient discovery feed — city-wide, browsable, always fresh, no
  login. Not personalization, not "since your last visit" (deferred).
- **Placement:** compact "Latest" strip on the homepage that links out to a
  full `/activity` destination page.
- **Signal:** significance-ranked. Show all milestone types but rank/filter by
  significance so trivial permits drop below the fold.
- **Recency clock:** event date (MVP). Window on each permit's own
  `filed_date` / `issued_date` / `completed_date` (and `pipeline_status_date`
  when pipeline says Construction). No snapshot diffing, no new infrastructure.
  Accepts that late-arriving backdated records may be missed — first-seen
  tracking is an explicit fast-follow.

## Architecture — one derivation, three surfaces

The core logic lives in exactly one place:

```
lib/activity.ts
  computeActivity(permits: Permit[], now: number, opts?): ActivityEvent[]
```

- After `dedupeProjectPermits()` (from `lib/permit-style`), each permit yields
  **at most one** `ActivityEvent`, for its *most recent milestone within the
  window*.
- Milestone = the permit's current stage via `permitStage()` mapped to its
  driving date field:
  - `filed` → `filed_date`
  - `approved` / `permitted` → `issued_date`
  - `complete` → `completed_date`
  - `construction` ("construction just started") → `pipeline_status_date` when
    `pipeline_status === 'Construction'` (the date the project flipped to
    Construction — the truest "just started" signal), else
    `status_date`/`issued_date` fallback. Construction-start detection leans on
    the pipeline join; raw permit fields alone can only approximate it.
  The chosen event date is the most recent such date; permits whose driving
  date is outside the window (default 30 days) are dropped.
- Each event carries a **significance score**, computed from, in priority
  order: net homes added (`netDelta(existing_units, proposed_units)`,
  dominant), `estimated_cost`, a boost when the permit is pipeline-tracked, and
  net stories added (`proposed_stories - existing_stories`). Score drives
  ranking and the "is this worth showing" filter threshold.

```ts
interface ActivityEvent {
  permit: Permit
  stage: PermitStage        // reuse existing type
  eventDate: string         // ISO; the milestone's driving date
  netHomes: number          // net dwelling units added (>= 0 for display)
  cost: number | null       // parsed estimated_cost
  useCategory: UseCategory  // reuse existing helper
  score: number             // significance, for ranking + threshold
}
```

`computeActivity` is a **pure function** — no I/O — so it is trivially
unit-testable and reused identically across every surface.

### Three consumers

| Surface | File | Notes |
|---|---|---|
| Full feed page | `app/activity/page.tsx` | Server component. The destination. Reads the Redis snapshot (live-DataSF fallback), calls `computeActivity`, renders the ranked list. |
| Homepage teaser | `components/ActivityTeaser.tsx` | Compact "Latest" strip, top ~5 events, "See all →" link to `/activity`. Placed so it complements the map, does not compete with it (exact placement confirmed against `app/page.tsx` at plan time). |
| Atom feed | `app/feed.xml/route.ts` | **Refactored** to consume `computeActivity`, replacing its current inline stage/date/netDelta logic. Removes duplication; single source of truth for "what counts as recent activity." |

All three read from the existing daily Redis snapshot via the current
`permit-cache` path, with the same live-DataSF fallback the rest of the app
uses. No new data infrastructure.

## The feed item & page UX

Each row reuses the Atom feed's proven content shape:

- **stage-colored dot** (from `STAGE_COLORS`) · **address** · **stage label**
  (`STAGE_LABELS`) · **`+N net homes`** when > 0.
- Secondary line: permit type definition, `timeAgo(eventDate)`, and estimated
  cost shown when notable.
- **Primary click** deep-links into the map: `/?lat=…&lng=…&permit=…`.
- **Secondary link** to the permit detail page `/permits/[permit_number]`.

Page controls:

- **Default sort: significance-ranked**, with a **"Newest first"** toggle.
- **Stage filter chips** — Filed / Approved / Under construction / Completed —
  reusing existing filter styling, so a reader can narrow to e.g. only
  completions.
- **Window: rolling 30 days.** With significance ranking this yields enough
  interesting volume on any given day while still feeling fresh (7 days would
  often look empty since big projects are rare). One-line tunable constant.

## Error handling

- **Snapshot missing / stale:** fall back to a live DataSF fetch — existing
  app-wide pattern, nothing new.
- **Empty window:** quiet empty state — "No major activity in the last 30
  days." (Rare in practice.)
- **Bad/absent dates:** guarded via existing date helpers; a permit with no
  usable driving date is skipped rather than crashing.

## Testing

`__tests__/activity.test.ts`, matching the per-lib unit-test convention
(`stats`, `public-permits`, `transit`, `mohcd` each have one):

- windowing — events outside the window are excluded; on the boundary included.
- one-event-per-permit — a permit with multiple recent dates emits a single
  event for its most recent milestone.
- significance ranking — higher net-homes / cost / pipeline-tracked events sort
  first.
- dedupe — multi-permit projects collapse via `dedupeProjectPermits`.
- empty input → empty output, no throw.

## Out of scope (YAGNI — deferred, already on the roadmap)

- First-seen tracker (truer "what changed," catches backdated records).
- Personalization / "since your last visit."
- Per-neighborhood and per-category RSS feeds.
- Email / push subscriptions.
- Tiered "Major projects vs All activity" sectioning (single ranked list for
  MVP).

## Reused building blocks (no reinvention)

- `lib/permit-style.ts`: `permitStage`, `PermitStage`, `STAGE_LABELS`,
  `STAGE_COLORS`, `STAGE_ORDER`, `netDelta`, `dedupeProjectPermits`, `timeAgo`,
  `useCategory`, `UseCategory`.
- `lib/permit-cache.ts`: snapshot read + live fallback.
- `app/feed.xml/route.ts`: existing content shape and deep-link URL format.
