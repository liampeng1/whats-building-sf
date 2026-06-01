'use client'
import type { TierStats, TransitTier } from '@/lib/cross-stats'
import type { TierLensStats } from '@/lib/lens-stats'
import { METRIC_DEFINITIONS } from '@/lib/metric-definitions'
import { TIER_ORDER, TIER_LABELS, TIER_COLORS } from '@/lib/transit-tiers-style'

interface Props {
  geo: TierStats[]
  lens: Record<string, TierLensStats>
  onSelect: (tier: TransitTier) => void
  selectedTier?: TransitTier | null
}

const DEF_KEY: Record<TransitTier, keyof typeof METRIC_DEFINITIONS> = {
  rail: 'transitTierRail',
  'rapid-bus': 'transitTierRapidBus',
  'local-bus': 'transitTierLocalBus',
  poor: 'transitTierPoor',
}

export function TransitDirectory({ geo, lens, onSelect, selectedTier = null }: Props) {
  const byTier = new Map(geo.map((t) => [t.tier, t]))
  return (
    <div className="mt-2 font-sans text-ink">
      <div className="text-[9px] font-mono uppercase tracking-wider text-ink-faint mb-1">
        Transit access · land share
      </div>
      <ul>
        {TIER_ORDER.map((tier) => {
          const g = byTier.get(tier)
          const l = lens[tier]
          if (!g) return null
          const isSel = selectedTier === tier
          const color = TIER_COLORS[tier]
          return (
            <li
              key={tier}
              className={`border-b border-paper-edge/40 py-2 ${isSel ? 'bg-paper-deep -mx-3 px-3' : ''}`}
            >
              <button
                type="button"
                aria-pressed={isSel}
                onClick={() => onSelect(tier)}
                className="w-full text-left"
              >
                <div className="flex items-center gap-2 font-serif text-[13px]">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: color }}
                  />
                  {TIER_LABELS[tier]}
                </div>
                <div className="grid grid-cols-[1fr_36px] items-center gap-1.5 mt-1">
                  <Bar pct={g.share_of_sf} color={color} />
                  <span className="text-right font-mono text-[10px] font-bold text-ink-soft">
                    {pct(g.share_of_sf)}
                  </span>
                </div>
                <p className="text-[10px] text-ink-faint mt-1">
                  {METRIC_DEFINITIONS[DEF_KEY[tier]]}
                </p>
                {l && (
                  <p className="text-[10.5px] font-mono text-ink-soft mt-1">
                    <span className="text-construction font-semibold">{`${l.permits.toLocaleString()} permits`}</span>
                    {' · '}
                    <span className="text-construction font-semibold">{`${l.homes.toLocaleString()} homes`}</span>
                  </p>
                )}
                {l?.dominant_zoning && (
                  <p className="text-[10px] text-ink-faint mt-0.5">
                    Mostly <span className="text-ink font-medium">{l.dominant_zoning}</span>
                  </p>
                )}
              </button>
            </li>
          )
        })}
      </ul>
      <p className="text-[10px] text-ink-faint mt-2">
        Share of SF land area by nearest frequent transit.
      </p>
    </div>
  )
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <span className="inline-block h-1.5 w-full bg-paper-deep rounded overflow-hidden">
      <span
        className="block h-full"
        style={{ width: `${Math.max(0, Math.min(1, pct)) * 100}%`, background: color }}
      />
    </span>
  )
}

function pct(x: number): string {
  if (!Number.isFinite(x)) return '—'
  if (x === 0) return '0%'
  if (x < 0.005) return '<1%'
  return `${Math.round(x * 100)}%`
}
