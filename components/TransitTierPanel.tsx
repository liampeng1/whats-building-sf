'use client'
import type { TierStats, TransitTier } from '@/lib/cross-stats'
import type { TierLensStats } from '@/lib/lens-stats'
import { LensInfoPanel } from './LensInfoPanel'
import { METRIC_DEFINITIONS } from '@/lib/metric-definitions'
import { TIER_LABELS } from '@/lib/transit-tiers-style'

const DEF_KEY: Record<TransitTier, keyof typeof METRIC_DEFINITIONS> = {
  rail: 'transitTierRail',
  'rapid-bus': 'transitTierRapidBus',
  'local-bus': 'transitTierLocalBus',
  poor: 'transitTierPoor',
}

interface Props {
  tier: TransitTier | null
  stats: TierStats[]
  lens: Record<string, TierLensStats> | null
  onClose: () => void
}

/**
 * Detail panel for a selected transit-access tier. Thin wrapper over the
 * shared LensInfoPanel chrome (same sheet the station/zoning panels use).
 */
export function TransitTierPanel({ tier, stats, lens, onClose }: Props) {
  const g = tier ? stats.find((t) => t.tier === tier) : undefined
  const l = tier && lens ? lens[tier] : undefined

  const rows = l
    ? [
        { label: 'Permits (12 mo)', value: l.permits.toLocaleString(), color: '#9a4a31' },
        { label: 'Homes added (12 mo)', value: l.homes.toLocaleString(), color: '#9a4a31' },
      ]
    : []

  return (
    <LensInfoPanel
      open={!!tier && !!g}
      eyebrow="Transit access"
      title={tier ? TIER_LABELS[tier] : '—'}
      subtitle={tier ? METRIC_DEFINITIONS[DEF_KEY[tier]] : undefined}
      hero={
        g
          ? {
              eyebrow: 'Share of SF land',
              value: `${Math.round(g.share_of_sf * 100)}%`,
              detail: l?.dominant_zoning ? `Mostly ${l.dominant_zoning}` : undefined,
            }
          : undefined
      }
      primary={{ eyebrow: 'Recent activity', rows }}
      onClose={onClose}
    />
  )
}
