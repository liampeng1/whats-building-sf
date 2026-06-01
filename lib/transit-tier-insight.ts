/**
 * Pure, client-side rollups for the transit-tier detail panel. All three
 * helpers take an injected `classify` (a tier classifier) so they stay
 * pure and unit-testable without loading station data.
 *
 * Homes per permit = max(0, netDelta) — demolitions (negative deltas) are
 * floored at 0 so they don't pull the "new homes" totals negative.
 */
import type { Permit } from './types'
import type { TransitTier } from './cross-stats'
import {
  netDelta,
  permitStage,
  STAGE_ORDER,
  type PermitStage,
} from './permit-style'

type Classify = (coords: [number, number] | null | undefined) => TransitTier

// Stages shown in the panel — `inactive` is off-track noise, excluded to
// match the app's default stage filter.
const PIPELINE_STAGES: PermitStage[] = STAGE_ORDER.filter((s) => s !== 'inactive')

function homesOf(p: Permit): number {
  const d = netDelta(p.existing_units, p.proposed_units)
  return d != null && d > 0 ? d : 0
}

const ZERO_BY_TIER: Record<TransitTier, number> = {
  rail: 0,
  'very-frequent-bus': 0,
  'frequent-bus': 0,
  'basic-bus': 0,
  poor: 0,
}

/** Share of net new homes attributable to each tier (sums to 1, or all 0). */
export function homesShareByTier(
  permits: Permit[],
  classify: Classify,
): Record<TransitTier, number> {
  const homes: Record<TransitTier, number> = { ...ZERO_BY_TIER }
  let total = 0
  for (const p of permits) {
    const h = homesOf(p)
    if (h === 0) continue
    homes[classify(p.location?.coordinates)] += h
    total += h
  }
  if (total === 0) return { ...ZERO_BY_TIER }
  return {
    rail: homes.rail / total,
    'very-frequent-bus': homes['very-frequent-bus'] / total,
    'frequent-bus': homes['frequent-bus'] / total,
    'basic-bus': homes['basic-bus'] / total,
    poor: homes.poor / total,
  }
}

/**
 * Ratio of a tier's homes-share to its land-share. >1 means new housing
 * concentrates in this tier relative to its footprint; <1 means it lags.
 * Null when landShare is 0 (ratio undefined).
 */
export function disparityRatio(
  landShare: number,
  homesShare: number,
): number | null {
  if (!landShare) return null
  return homesShare / landShare
}

export interface StageRow {
  stage: PermitStage
  permits: number
  homes: number
}

export interface StageBreakdown {
  rows: StageRow[]
  totalPermits: number
  totalHomes: number
}

/** Per-stage permit count + net homes for one tier, ordered, empties omitted. */
export function stageBreakdown(
  permits: Permit[],
  tier: TransitTier,
  classify: Classify,
): StageBreakdown {
  const byStage = new Map<PermitStage, { permits: number; homes: number }>()
  let totalPermits = 0
  let totalHomes = 0
  for (const p of permits) {
    if (classify(p.location?.coordinates) !== tier) continue
    const stage = permitStage(p)
    if (!PIPELINE_STAGES.includes(stage)) continue
    const agg = byStage.get(stage) ?? { permits: 0, homes: 0 }
    agg.permits += 1
    agg.homes += homesOf(p)
    byStage.set(stage, agg)
    totalPermits += 1
    totalHomes += homesOf(p)
  }
  const rows: StageRow[] = PIPELINE_STAGES.filter((s) => byStage.has(s)).map(
    (stage) => ({ stage, ...byStage.get(stage)! }),
  )
  return { rows, totalPermits, totalHomes }
}
