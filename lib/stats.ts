import type { Permit } from './types'
import { permitStage, netDelta, type PermitStage } from './permit-style'

/**
 * Pre-launch stats helpers. These compute aggregations over the permits
 * snapshot so the /stats page can render "the report the city doesn't
 * publish" without spinning up a dedicated DB. ~1500 permits is small
 * enough to crunch on every request; if traffic warrants we can pre-bake
 * these into the nightly Redis snapshot later.
 */

const DAY_MS = 86_400_000

function daysBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null
  const ad = new Date(a).getTime()
  const bd = new Date(b).getTime()
  if (!Number.isFinite(ad) || !Number.isFinite(bd)) return null
  return Math.round((bd - ad) / DAY_MS)
}

function daysAgo(dateStr: string | null, now: number = Date.now()): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr).getTime()
  if (!Number.isFinite(d)) return null
  return Math.round((now - d) / DAY_MS)
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))))
  return sorted[idx]
}

export interface StalledEntry {
  permit: Permit
  daysInStage: number
  stage: PermitStage
}

export interface StageCount {
  stage: PermitStage
  count: number
  homes: number
}

export interface StatsBundle {
  // Top-line totals
  totalTracked: number
  totalUnitsInPipeline: number  // sum of positive deltas across active stages
  completedLast2y: number
  unitsCompletedLast2y: number
  underConstruction: number
  unitsUnderConstruction: number

  // Distribution: days from filed → issued
  filedToIssuedMedian: number | null
  filedToIssuedP90: number | null
  filedToIssuedSampleSize: number

  // Pipeline conversion rates (cohort filed 5+ years ago)
  conversionCohortYears: [number, number]  // window e.g. [2018, 2021]
  conversionFiledCount: number
  conversionReachedPermitted: number  // permits that reached permitted+ stages
  conversionReachedConstruction: number
  conversionReachedComplete: number

  // Year-over-year filings
  filingsByYear: { year: number; count: number; homes: number }[]

  // Stage breakdown right now
  byStage: StageCount[]

  // Top 10 longest-stalled (approved or permitted, >365d in stage)
  stalled: StalledEntry[]

  // RHNA — SF 2023-2031 cycle target = 82,069 units
  rhnaTarget: number
  rhnaCycleStart: string
  rhnaCycleEnd: string
  rhnaUnitsDelivered: number
  rhnaRequiredAnnual: number
  rhnaCurrentAnnualPace: number
}

const STALL_THRESHOLD_DAYS = 365
const RHNA_CYCLE = {
  start: '2023-01-15',
  end: '2031-01-31',
  target: 82069,
}

export function computeStats(permits: Permit[], now: number = Date.now()): StatsBundle {
  const totalTracked = permits.length

  // Stage counts + units per stage
  const stageMap = new Map<PermitStage, { count: number; homes: number }>()
  let totalUnitsInPipeline = 0
  let underConstruction = 0
  let unitsUnderConstruction = 0
  let completedLast2y = 0
  let unitsCompletedLast2y = 0
  const cutoff2y = now - 2 * 365 * DAY_MS
  let unitsCompletedSinceRhnaStart = 0
  const rhnaStart = new Date(RHNA_CYCLE.start).getTime()

  for (const p of permits) {
    const stage = permitStage(p)
    const homes = Math.max(0, netDelta(p.existing_units, p.proposed_units) ?? 0)
    const cur = stageMap.get(stage) ?? { count: 0, homes: 0 }
    cur.count += 1
    cur.homes += homes
    stageMap.set(stage, cur)

    // Units in active pipeline = anything not complete or inactive
    if (stage !== 'complete' && stage !== 'inactive') {
      totalUnitsInPipeline += homes
    }
    if (stage === 'construction') {
      underConstruction += 1
      unitsUnderConstruction += homes
    }
    if (stage === 'complete' && p.completed_date) {
      const compTime = new Date(p.completed_date).getTime()
      if (compTime >= cutoff2y) {
        completedLast2y += 1
        unitsCompletedLast2y += homes
      }
      if (compTime >= rhnaStart) {
        unitsCompletedSinceRhnaStart += homes
      }
    }
  }

  // Filed → issued distribution
  const filedToIssued: number[] = []
  for (const p of permits) {
    const d = daysBetween(p.filed_date, p.issued_date)
    if (d != null && d >= 0 && d < 365 * 8) filedToIssued.push(d)
  }
  const filedToIssuedMedian = percentile(filedToIssued, 50)
  const filedToIssuedP90 = percentile(filedToIssued, 90)

  // Conversion cohort: permits filed 4–7 years ago (gives them time to progress)
  const cohortStart = new Date()
  cohortStart.setFullYear(cohortStart.getFullYear() - 7)
  const cohortEnd = new Date()
  cohortEnd.setFullYear(cohortEnd.getFullYear() - 4)
  let conversionFiledCount = 0
  let conversionReachedPermitted = 0
  let conversionReachedConstruction = 0
  let conversionReachedComplete = 0
  for (const p of permits) {
    if (!p.filed_date) continue
    const t = new Date(p.filed_date).getTime()
    if (!Number.isFinite(t)) continue
    if (t < cohortStart.getTime() || t > cohortEnd.getTime()) continue
    conversionFiledCount += 1
    const stage = permitStage(p)
    // "Reached permitted" includes permitted, construction, complete
    if (stage === 'permitted' || stage === 'construction' || stage === 'complete') {
      conversionReachedPermitted += 1
    }
    if (stage === 'construction' || stage === 'complete') {
      conversionReachedConstruction += 1
    }
    if (stage === 'complete') {
      conversionReachedComplete += 1
    }
  }

  // Year-over-year filings (last 8 calendar years)
  const yearMap = new Map<number, { count: number; homes: number }>()
  for (const p of permits) {
    if (!p.filed_date) continue
    const y = new Date(p.filed_date).getFullYear()
    if (!Number.isFinite(y)) continue
    const homes = Math.max(0, netDelta(p.existing_units, p.proposed_units) ?? 0)
    const cur = yearMap.get(y) ?? { count: 0, homes: 0 }
    cur.count += 1
    cur.homes += homes
    yearMap.set(y, cur)
  }
  const filingsByYear = [...yearMap.entries()]
    .map(([year, v]) => ({ year, count: v.count, homes: v.homes }))
    .filter((r) => r.year >= new Date().getFullYear() - 8 && r.year <= new Date().getFullYear())
    .sort((a, b) => a.year - b.year)

  // Stalled: stage in {approved, permitted} and status_date or issued_date older than threshold
  const stalledCandidates: StalledEntry[] = []
  for (const p of permits) {
    const stage = permitStage(p)
    if (stage !== 'approved' && stage !== 'permitted') continue
    // Days since the most recent date that signals "this is the current state"
    const anchor = p.status_date || p.issued_date || p.filed_date
    const days = daysAgo(anchor, now)
    if (days == null || days < STALL_THRESHOLD_DAYS) continue
    stalledCandidates.push({ permit: p, daysInStage: days, stage })
  }
  const stalled = stalledCandidates.sort((a, b) => b.daysInStage - a.daysInStage).slice(0, 10)

  // RHNA progress
  const cycleYears =
    (new Date(RHNA_CYCLE.end).getTime() - new Date(RHNA_CYCLE.start).getTime()) /
    (365.25 * DAY_MS)
  const yearsElapsed = (now - rhnaStart) / (365.25 * DAY_MS)
  const rhnaRequiredAnnual = RHNA_CYCLE.target / cycleYears
  const rhnaCurrentAnnualPace = yearsElapsed > 0 ? unitsCompletedSinceRhnaStart / yearsElapsed : 0

  const byStage: StageCount[] = [...stageMap.entries()]
    .map(([stage, v]) => ({ stage, count: v.count, homes: v.homes }))
    .sort((a, b) => b.count - a.count)

  return {
    totalTracked,
    totalUnitsInPipeline,
    completedLast2y,
    unitsCompletedLast2y,
    underConstruction,
    unitsUnderConstruction,
    filedToIssuedMedian,
    filedToIssuedP90,
    filedToIssuedSampleSize: filedToIssued.length,
    conversionCohortYears: [cohortStart.getFullYear(), cohortEnd.getFullYear()],
    conversionFiledCount,
    conversionReachedPermitted,
    conversionReachedConstruction,
    conversionReachedComplete,
    filingsByYear,
    byStage,
    stalled,
    rhnaTarget: RHNA_CYCLE.target,
    rhnaCycleStart: RHNA_CYCLE.start,
    rhnaCycleEnd: RHNA_CYCLE.end,
    rhnaUnitsDelivered: unitsCompletedSinceRhnaStart,
    rhnaRequiredAnnual,
    rhnaCurrentAnnualPace,
  }
}
