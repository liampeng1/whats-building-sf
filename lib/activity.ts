/**
 * Recent-activity feed derivation. Turns the daily permits snapshot into a
 * ranked list of "what just happened" events — permits just filed, approved,
 * construction just started, and buildings just completed.
 *
 * Pure function, no I/O: every surface (the /activity page, the homepage
 * teaser, and the /feed.xml Atom feed) computes from the same logic so
 * "recent activity" means exactly one thing across the app.
 *
 * Recency clock is the permit's own milestone date (event-date MVP) — no
 * snapshot diffing. A permit whose driving date falls outside the window is
 * dropped; backdated late-arriving records are a known limitation (see the
 * first-seen tracker fast-follow in the design spec).
 */

import type { Permit } from './types'
import {
  type PermitStage,
  type UseCategory,
  permitStage,
  netDelta,
  useCategory,
  dedupeProjectPermits,
  USE_CATEGORY_LABELS,
} from './permit-style'

export interface ActivityEvent {
  permit: Permit
  stage: PermitStage
  /** ISO date string — the milestone's driving date. */
  eventDate: string
  /** Net dwelling units added; clamped to >= 0 for display. */
  netHomes: number
  /** Parsed estimated cost in dollars, or null when unknown/unparseable. */
  cost: number | null
  useCategory: UseCategory
  /** Significance score used for ranking and below-the-fold ordering. */
  score: number
}

// Short, feed-friendly milestone verbs — "what just happened", distinct from
// the lifecycle-stage nouns (STAGE_LABELS) used elsewhere in the app.
export const MILESTONE_LABELS: Record<PermitStage, string> = {
  filed: 'Filed',
  approved: 'Approved',
  permitted: 'Permit issued',
  construction: 'Construction started',
  complete: 'Completed',
  inactive: 'Inactive',
}

export interface ComputeActivityOptions {
  /** Rolling window in days. Default 30. */
  windowDays?: number
  /** Cap the number of events returned (after ranking). */
  limit?: number
}

const DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_WINDOW_DAYS = 30

// Significance weights. Net homes dominate; cost is measured in $M so a
// multi-million-dollar project nudges up without overpowering a unit-heavy
// one; added stories are a mild proxy for scale; pipeline-tracked projects
// (SF Planning curates these) get a small, deliberate boost.
const W_HOMES = 10
const W_STORIES = 2
const W_COST_PER_MILLION = 1
const PIPELINE_BOOST = 5

/**
 * The date that drives a permit's current milestone. Pipeline-curated dates
 * are preferred where the stage came from the pipeline join (its dates are
 * SF Planning ground truth); otherwise we fall back to the raw permit fields.
 */
function drivingDate(p: Permit, stage: PermitStage): string | null {
  const pipelineDated = p.pipeline_status_date
  switch (stage) {
    case 'filed':
      return p.filed_date
    case 'approved':
      return pipelineDated ?? p.status_date ?? p.filed_date
    case 'permitted':
      return p.issued_date ?? pipelineDated ?? p.status_date
    case 'construction':
      return pipelineDated ?? p.status_date ?? p.issued_date
    case 'complete':
      return p.completed_date ?? p.status_date
    default:
      // 'inactive' (cancelled/expired/withdrawn) isn't a feed milestone.
      return null
  }
}

function parseCost(raw: string | null): number | null {
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function significance(permit: Permit, netHomes: number, cost: number | null): number {
  const storiesAdded = Math.max(0, netDelta(permit.existing_stories, permit.proposed_stories) ?? 0)
  const costMillions = cost != null ? cost / 1_000_000 : 0
  const pipelineTracked = permit.pipeline_status != null
  return (
    netHomes * W_HOMES +
    storiesAdded * W_STORIES +
    costMillions * W_COST_PER_MILLION +
    (pipelineTracked ? PIPELINE_BOOST : 0)
  )
}

export function computeActivity(
  permits: Permit[],
  now: number,
  opts: ComputeActivityOptions = {},
): ActivityEvent[] {
  const windowDays = opts.windowDays ?? DEFAULT_WINDOW_DAYS
  const cutoff = now - windowDays * DAY_MS

  const events: ActivityEvent[] = []
  for (const permit of dedupeProjectPermits(permits)) {
    const stage = permitStage(permit)
    const dateStr = drivingDate(permit, stage)
    if (!dateStr) continue

    const t = new Date(dateStr).getTime()
    if (!Number.isFinite(t)) continue
    if (t > now) continue // future-dated: bad data
    if (t < cutoff) continue // outside the window

    const netHomes = Math.max(0, netDelta(permit.existing_units, permit.proposed_units) ?? 0)
    const cost = parseCost(permit.estimated_cost)

    events.push({
      permit,
      stage,
      eventDate: dateStr,
      netHomes,
      cost,
      useCategory: useCategory(permit.proposed_use),
      score: significance(permit, netHomes, cost),
    })
  }

  events.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    // Tie-break: most recent event first.
    return new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime()
  })

  return opts.limit != null ? events.slice(0, opts.limit) : events
}

/**
 * Compact money label for feed rows: $589K, $1.9M, $7M, $1.2B. Returns null
 * for missing/non-positive costs so callers can omit the field entirely.
 */
export function formatCostShort(cost: number | null): string | null {
  if (cost == null || !Number.isFinite(cost) || cost <= 0) return null
  const abbr = (v: number, suffix: string) => `$${v.toFixed(1).replace(/\.0$/, '')}${suffix}`
  if (cost >= 1e9) return abbr(cost / 1e9, 'B')
  if (cost >= 1e6) return abbr(cost / 1e6, 'M')
  if (cost >= 1e3) return `$${Math.round(cost / 1e3)}K`
  return `$${Math.round(cost)}`
}

/**
 * Human-readable scope for an activity item: a few scale chips derived from the
 * structured fields (reliable), plus the permit's own free-text description
 * blurb (the story), lightly normalized. Both are optional — callers render
 * whatever is present.
 */
export function activityScope(event: ActivityEvent): { chips: string[]; blurb: string | null } {
  const chips: string[] = []

  const stories = Number(event.permit.proposed_stories)
  if (Number.isFinite(stories) && stories > 0) chips.push(`${stories}-story`)

  if (event.netHomes > 0) chips.push(`${event.netHomes} home${event.netHomes === 1 ? '' : 's'}`)

  if (event.useCategory !== 'other') chips.push(USE_CATEGORY_LABELS[event.useCategory])

  const raw = event.permit.description?.trim().replace(/\s+/g, ' ')
  const blurb = raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : null

  return { chips, blurb }
}
