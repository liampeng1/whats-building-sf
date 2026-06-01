/**
 * Single source of truth for transit-tier presentation: order, labels,
 * colors, and the heat-layer fill opacity. Shared by TransitTierOverlay
 * (map), TransitDirectory (drawer legend), and TransitTierPanel (detail)
 * so the five levels read identically everywhere.
 */
import type { TransitTier } from '@/lib/cross-stats'

export const TIER_ORDER: TransitTier[] = [
  'rail',
  'very-frequent-bus',
  'frequent-bus',
  'basic-bus',
  'poor',
]

export const TIER_LABELS: Record<TransitTier, string> = {
  rail: 'Rail-served',
  'very-frequent-bus': 'Very frequent bus',
  'frequent-bus': 'Frequent bus',
  'basic-bus': 'Basic bus',
  poor: 'Transit-poor',
}

// Sequential ramp over the existing transit palette: strongest access reads
// darkest/warmest, fading to a muted taupe so the heat fill and the corridor
// lines drawn on top read as one system.
export const TIER_COLORS: Record<TransitTier, string> = {
  rail: '#1c2438', // navy — BART/rail
  'very-frequent-bus': '#9a4a31', // sienna — strongest bus access
  'frequent-bus': '#c08552', // amber
  'basic-bus': '#7d9b76', // sage
  poor: '#a8a29e', // taupe — muted, recedes
}

// Base fill opacity: strongest access reads darkest, transit-poor barely
// tints so it stays background.
export const TIER_BASE_OPACITY: Record<TransitTier, number> = {
  rail: 0.42,
  'very-frequent-bus': 0.38,
  'frequent-bus': 0.3,
  'basic-bus': 0.2,
  poor: 0.1,
}

/**
 * Selection-aware fill opacity for the heat layer. With no selection every
 * tier uses its base opacity; once a tier is selected it brightens and the
 * others fade back (mirrors the zoning-district dimming).
 */
export function tierFillOpacity(
  tier: TransitTier,
  selectedTier: TransitTier | null,
): number {
  if (!selectedTier) return TIER_BASE_OPACITY[tier]
  return tier === selectedTier ? 0.55 : 0.04
}
