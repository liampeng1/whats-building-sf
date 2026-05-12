'use client'
import type { TierStats, TransitTier } from '@/lib/cross-stats'
import type { TierLensStats } from '@/lib/lens-stats'
import { METRIC_DEFINITIONS } from '@/lib/metric-definitions'

interface Props {
  geo: TierStats[]
  lens: Record<string, TierLensStats>
  onSelect: (tier: TransitTier) => void
}

const TIER_ORDER: TransitTier[] = ['rail', 'rapid-bus', 'local-bus', 'poor']
const LABELS: Record<TransitTier, string> = {
  rail:        'Rail-served',
  'rapid-bus': 'Rapid-bus only',
  'local-bus': 'Local-bus only',
  poor:        'Transit-poor',
}
const DEF_KEY: Record<TransitTier, keyof typeof METRIC_DEFINITIONS> = {
  rail:        'transitTierRail',
  'rapid-bus': 'transitTierRapidBus',
  'local-bus': 'transitTierLocalBus',
  poor:        'transitTierPoor',
}

export function TransitDirectory({ geo, lens, onSelect }: Props) {
  const byTier = new Map(geo.map((t) => [t.tier, t]))
  return (
    <ul className="mt-2 font-sans text-ink">
      {TIER_ORDER.map((tier) => {
        const g = byTier.get(tier)
        const l = lens[tier]
        if (!g) return null
        return (
          <li key={tier} className="border-b border-paper-edge/40 py-2">
            <button
              type="button"
              onClick={() => onSelect(tier)}
              className="w-full text-left"
            >
              <h4 className="font-serif text-[13px]">{LABELS[tier]}</h4>
              <p className="text-[10px] text-ink-faint mt-0.5">
                {METRIC_DEFINITIONS[DEF_KEY[tier]]}
              </p>
              <p className="text-[10.5px] font-mono text-ink-soft mt-1">
                <span className="text-construction font-semibold">{`${Math.round(g.share_of_sf * 100)}% of SF`}</span>
                {l ? <> · <span className="text-construction font-semibold">{`${l.permits.toLocaleString()} permits`}</span></> : null}
                {l ? <> · <span className="text-construction font-semibold">{`${l.homes.toLocaleString()} homes`}</span></> : null}
              </p>
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
  )
}
