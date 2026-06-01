/**
 * Pure aggregator for /api/lens-stats. Consumes a permit array and a "now"
 * timestamp; returns per-neighborhood, per-zoning, and per-transit-tier
 * rollups for the trailing 12 months.
 *
 * Pure — no I/O, no globals. The route handler at app/api/lens-stats/route.ts
 * is the I/O shell that loads permits + supplies a tier classifier.
 *
 * Field-name note: this module reads camelCase fields (filedDate,
 * issuedDate, netUnits, neighborhood, useCategory, stage, zoning_category)
 * from the permit objects passed in. The on-disk DataSF Permit type in
 * `lib/types.ts` uses snake_case (filed_date, etc.). Tasks earlier in this
 * plan are expected to enrich/transform the permits into the lens-flavored
 * shape before they reach the aggregator. Accesses go through `as any` so
 * either shape compiles; if the caller hands us the raw snake_case rows,
 * the window-membership check will simply skip every record (no crash).
 */

import type { Permit } from '@/lib/types'
import type { TransitTier } from '@/lib/cross-stats'
import type { UseCategory } from '@/lib/permit-style'

export interface LensStatsInput {
  permits: Permit[]
  now: Date
  classifyTier?: (coords: [number, number]) => TransitTier
}

export interface NhoodLensStats {
  permits_12mo: number
  homes_added_12mo: number
  yoy_pct: number
  /** -1 sentinel when no permits in the window have an issued date. */
  median_days_to_permit: number
}

export interface ZoningLensStats {
  permits_share: number
  top_neighborhoods: string[]
}

export interface TierLensStats {
  permits: number
  homes: number
  dominant_zoning: string
  /** Share (0..1) of the tier's permits by use category. */
  use_mix: Partial<Record<UseCategory, number>>
}

export interface LensStats {
  neighborhoods: Record<string, NhoodLensStats>
  zoning: Record<string, ZoningLensStats>
  transit_tiers: Record<TransitTier, TierLensStats>
}

const MS_PER_DAY = 86_400_000

export function computeLensStats(input: LensStatsInput): LensStats {
  const { permits, now, classifyTier } = input
  const windowStart = new Date(now.getTime() - 365 * MS_PER_DAY)
  const priorStart = new Date(now.getTime() - 2 * 365 * MS_PER_DAY)

  const filedOf = (p: Permit): string | null =>
    ((p as any).filedDate ?? null) as string | null

  const inWindow = (p: Permit): boolean => {
    const filed = filedOf(p)
    if (!filed) return false
    const d = new Date(filed)
    return d >= windowStart && d <= now
  }
  const inPriorWindow = (p: Permit): boolean => {
    const filed = filedOf(p)
    if (!filed) return false
    const d = new Date(filed)
    return d >= priorStart && d < windowStart
  }

  // ---- nhoods ----
  const nhoodAgg: Record<string, NhoodLensStats & { _days: number[] }> = {}
  const priorByNhood: Record<string, number> = {}
  for (const p of permits) {
    const nb = (p as any).neighborhood as string | undefined
    if (!nb) continue
    if (inWindow(p)) {
      nhoodAgg[nb] = nhoodAgg[nb] ?? {
        permits_12mo: 0, homes_added_12mo: 0, yoy_pct: 0,
        median_days_to_permit: -1, _days: [],
      }
      nhoodAgg[nb].permits_12mo++
      nhoodAgg[nb].homes_added_12mo += ((p as any).netUnits as number) ?? 0
      const issued = (p as any).issuedDate as string | null | undefined
      const filed = filedOf(p)
      if (issued && filed) {
        const days = Math.round(
          (new Date(issued).getTime() - new Date(filed).getTime()) / MS_PER_DAY,
        )
        nhoodAgg[nb]._days.push(days)
      }
    } else if (inPriorWindow(p)) {
      priorByNhood[nb] = (priorByNhood[nb] ?? 0) + 1
    }
  }
  const neighborhoods: Record<string, NhoodLensStats> = {}
  for (const [nb, agg] of Object.entries(nhoodAgg)) {
    const prior = priorByNhood[nb] ?? 0
    const yoy = prior === 0 ? 0 : (agg.permits_12mo - prior) / prior
    const days = agg._days.length ? median(agg._days) : -1
    neighborhoods[nb] = {
      permits_12mo: agg.permits_12mo,
      homes_added_12mo: agg.homes_added_12mo,
      yoy_pct: yoy,
      median_days_to_permit: days,
    }
  }

  // ---- zoning ----
  // Permit→zoning enrichment is logged in PLAN.md as deferred. Until permits
  // carry zoning_category, this returns an empty map. When they do, we fall
  // through to category aggregation + share-of-window computation.
  const zoning: Record<string, ZoningLensStats> = {}
  const zoningCounts: Record<string, number> = {}
  const zoningByNhood: Record<string, Record<string, number>> = {}
  for (const p of permits) {
    if (!inWindow(p)) continue
    const cat = (p as any).zoning_category as string | undefined
    if (!cat) continue
    zoningCounts[cat] = (zoningCounts[cat] ?? 0) + 1
    const nb = (p as any).neighborhood as string | undefined
    if (nb) {
      zoningByNhood[cat] = zoningByNhood[cat] ?? {}
      zoningByNhood[cat][nb] = (zoningByNhood[cat][nb] ?? 0) + 1
    }
  }
  const totalZ = Object.values(zoningCounts).reduce((a, b) => a + b, 0)
  for (const [cat, count] of Object.entries(zoningCounts)) {
    const byNhood = zoningByNhood[cat] ?? {}
    const top = Object.entries(byNhood)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([nb]) => nb)
    zoning[cat] = {
      permits_share: totalZ > 0 ? count / totalZ : 0,
      top_neighborhoods: top,
    }
  }

  // ---- transit tiers ----
  const tierAgg: Record<TransitTier, TierLensStats> = {
    'rail':              { permits: 0, homes: 0, dominant_zoning: '', use_mix: {} },
    'very-frequent-bus': { permits: 0, homes: 0, dominant_zoning: '', use_mix: {} },
    'frequent-bus':      { permits: 0, homes: 0, dominant_zoning: '', use_mix: {} },
    'basic-bus':         { permits: 0, homes: 0, dominant_zoning: '', use_mix: {} },
    'poor':              { permits: 0, homes: 0, dominant_zoning: '', use_mix: {} },
  }
  const tierZoningCounts: Record<TransitTier, Record<string, number>> = {
    'rail': {}, 'very-frequent-bus': {}, 'frequent-bus': {}, 'basic-bus': {}, 'poor': {},
  }
  const tierUseCounts: Record<TransitTier, Partial<Record<UseCategory, number>>> = {
    'rail': {}, 'very-frequent-bus': {}, 'frequent-bus': {}, 'basic-bus': {}, 'poor': {},
  }
  if (classifyTier) {
    for (const p of permits) {
      if (!inWindow(p)) continue
      const coords = (p.location as any)?.coordinates as
        | [number, number]
        | undefined
      if (!coords) continue
      const tier = classifyTier(coords)
      tierAgg[tier].permits++
      tierAgg[tier].homes += ((p as any).netUnits as number) ?? 0
      const cat = (p as any).zoning_category as string | undefined
      if (cat) {
        tierZoningCounts[tier][cat] = (tierZoningCounts[tier][cat] ?? 0) + 1
      }
      const use = (p as any).useCategory as UseCategory | undefined
      if (use) {
        tierUseCounts[tier][use] = (tierUseCounts[tier][use] ?? 0) + 1
      }
    }
    for (const tier of Object.keys(tierAgg) as TransitTier[]) {
      const counts = tierZoningCounts[tier]
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
      tierAgg[tier].dominant_zoning = top ? top[0] : ''
      // Normalize the use counts into shares of the tier's permits.
      const useCounts = tierUseCounts[tier]
      const useTotal = Object.values(useCounts).reduce((a, b) => a + (b ?? 0), 0)
      const mix: Partial<Record<UseCategory, number>> = {}
      if (useTotal > 0) {
        for (const [use, n] of Object.entries(useCounts) as [UseCategory, number][]) {
          mix[use] = n / useTotal
        }
      }
      tierAgg[tier].use_mix = mix
    }
  }

  return { neighborhoods, zoning, transit_tiers: tierAgg }
}

function median(xs: number[]): number {
  const sorted = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid]
}
