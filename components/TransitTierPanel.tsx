'use client'
import type { TierStats, TransitTier } from '@/lib/cross-stats'
import type { TierLensStats } from '@/lib/lens-stats'
import type { Permit } from '@/lib/types'
import { LensInfoPanel } from './LensInfoPanel'
import { METRIC_DEFINITIONS } from '@/lib/metric-definitions'
import { TIER_LABELS } from '@/lib/transit-tiers-style'
import {
  homesShareByTier,
  disparityRatio,
  stageBreakdown,
} from '@/lib/transit-tier-insight'
import { classifyTier } from '@/lib/transit-stations'
import {
  permitStage,
  STAGE_COLORS,
  STAGE_LABELS,
  USE_CATEGORY_LABELS,
  CATEGORIES,
  type UseCategory,
} from '@/lib/permit-style'

const DEF_KEY: Record<TransitTier, keyof typeof METRIC_DEFINITIONS> = {
  rail: 'transitTierRail',
  'rapid-bus': 'transitTierRapidBus',
  'local-bus': 'transitTierLocalBus',
  poor: 'transitTierPoor',
}

// Earthy use-category palette — harmonizes with the rest of the lens chrome.
const USE_COLORS: Record<UseCategory, string> = {
  housing: '#7d9b76',
  retail: '#b08968',
  office: '#5d7a99',
  industrial: '#67615a',
  other: '#a8a29e',
}

interface Props {
  tier: TransitTier | null
  stats: TierStats[]
  lens: Record<string, TierLensStats> | null
  /** Filtered permits (already classified-eligible) for the stage + list sections. */
  permits: Permit[]
  onOpenPermit: (id: string) => void
  onClose: () => void
}

/**
 * Detail panel for a selected transit-access tier. Leads with the
 * land-vs-homes disparity argument, then profiles the tier: use mix,
 * pipeline by stage (permits + homes), and a clickable recent-permits
 * list. Sections 1/3/4 derive from the same client-side classification of
 * `permits` so the numbers stay internally consistent.
 */
export function TransitTierPanel({
  tier,
  stats,
  lens,
  permits,
  onOpenPermit,
  onClose,
}: Props) {
  const g = tier ? stats.find((t) => t.tier === tier) : undefined
  const l = tier && lens ? lens[tier] : undefined

  // Section 1 — disparity. Homes-share from the same client-side tiering.
  const landShare = g?.share_of_sf ?? 0
  const homesShare = tier ? homesShareByTier(permits, classifyTier)[tier] : 0
  const ratio = disparityRatio(landShare, homesShare)

  // Section 2 — use mix (from the lens-stats pipeline). `lens === null` means
  // the async /api/lens-stats fetch hasn't landed yet → show a loading hint
  // rather than a bare "No data." that flashes on first open.
  const useMixLoading = lens === null
  const useRows = l?.use_mix
    ? CATEGORIES.filter((c) => (l.use_mix![c] ?? 0) > 0).map((c) => ({
        label: USE_CATEGORY_LABELS[c],
        value: pct(l.use_mix![c]!),
        pct: l.use_mix![c]!,
        color: USE_COLORS[c],
      }))
    : []

  // Section 3 — pipeline by stage.
  const breakdown = tier
    ? stageBreakdown(permits, tier, classifyTier)
    : { rows: [], totalPermits: 0, totalHomes: 0 }

  // Section 4 — recent permits in tier (client-side, clickable).
  const tierPermits = tier
    ? permits.filter((p) => classifyTier(p.location?.coordinates) === tier)
    : []
  const recentPermits = [...tierPermits]
    .filter((p) => !!p.status_date)
    .sort((a, b) => (a.status_date! < b.status_date! ? 1 : -1))
    .slice(0, 5)

  const ratioDetail =
    ratio == null
      ? undefined
      : ratio >= 1
        ? `${ratio.toFixed(1)}× its land share`
        : `${ratio.toFixed(1)}× — building lags`

  return (
    <LensInfoPanel
      open={!!tier && !!g}
      eyebrow="Transit access"
      title={tier ? TIER_LABELS[tier] : '—'}
      subtitle={tier ? METRIC_DEFINITIONS[DEF_KEY[tier]] : undefined}
      hero={
        g
          ? {
              eyebrow: 'Land vs new homes',
              value: `${Math.round(landShare * 100)}% → ${Math.round(homesShare * 100)}%`,
              detail: ratioDetail,
            }
          : undefined
      }
      primary={{ eyebrow: 'Use mix (last 12 mo)', rows: useRows }}
      primaryEmpty={useMixLoading ? 'Loading…' : 'No permits in the last 12 months.'}
      onClose={onClose}
    >
      {/* Section 3 — pipeline by stage */}
      {breakdown.rows.length > 0 && (
        <div className="pt-5 border-t border-paper-edge">
          <div className="civic-eyebrow mb-3">Pipeline by stage</div>
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1.5 text-sm">
            <span className="text-[10px] uppercase tracking-wider text-ink-faint" />
            <span className="text-[10px] uppercase tracking-wider text-ink-faint text-right">Permits</span>
            <span className="text-[10px] uppercase tracking-wider text-ink-faint text-right">Homes</span>
            {breakdown.rows.map((r) => (
              <FragmentRow
                key={r.stage}
                color={STAGE_COLORS[r.stage].fill}
                label={STAGE_LABELS[r.stage].split(' / ')[0].split(' · ')[0]}
                permits={r.permits}
                homes={r.homes}
              />
            ))}
            <span className="border-t border-paper-edge/60 pt-1.5 text-ink font-medium">Total</span>
            <span className="border-t border-paper-edge/60 pt-1.5 text-right font-serif tabular-nums text-ink">
              {breakdown.totalPermits.toLocaleString()}
            </span>
            <span className="border-t border-paper-edge/60 pt-1.5 text-right font-serif tabular-nums text-ink">
              {breakdown.totalHomes.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* Section 4 — recent permits in tier */}
      {recentPermits.length > 0 && (
        <div className="pt-5 border-t border-paper-edge">
          <div className="civic-eyebrow mb-3">Recent permits</div>
          <ul className="space-y-2">
            {recentPermits.map((p) => {
              const stage = permitStage(p)
              const stageColor = STAGE_COLORS[stage].fill
              const stageLabel = STAGE_LABELS[stage].split(' / ')[0].split(' · ')[0]
              return (
                <li key={p.permit_number}>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenPermit(p.permit_number)
                      onClose()
                    }}
                    className="w-full text-left flex items-start gap-2 hover:bg-paper-deep -mx-2 px-2 py-1.5 rounded transition-colors"
                  >
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wide shrink-0 w-20 pt-0.5"
                      style={{ color: stageColor }}
                    >
                      {stageLabel}
                    </span>
                    <span className="font-serif text-ink text-sm leading-snug min-w-0 line-clamp-2">
                      {p.address}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </LensInfoPanel>
  )
}

function FragmentRow({
  color,
  label,
  permits,
  homes,
}: {
  color: string
  label: string
  permits: number
  homes: number
}) {
  return (
    <>
      <span className="flex items-center gap-2 min-w-0">
        <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
        <span className="text-ink truncate">{label}</span>
      </span>
      <span className="text-right font-serif tabular-nums text-ink-soft">{permits.toLocaleString()}</span>
      <span className="text-right font-serif tabular-nums text-ink-soft">{homes.toLocaleString()}</span>
    </>
  )
}

function pct(x: number): string {
  if (!Number.isFinite(x)) return '—'
  if (x === 0) return '0%'
  if (x < 0.005) return '<1%'
  return `${Math.round(x * 100)}%`
}
