/**
 * Single source of truth for transit-tier presentation: order, labels,
 * colors, and the heat-layer fill opacity. Shared by TransitTierOverlay
 * (map), TransitDirectory (drawer legend), and TransitTierPanel (detail)
 * so the four levels read identically everywhere.
 */
import type { TransitTier } from '@/lib/cross-stats'

export const TIER_ORDER: TransitTier[] = ['rail', 'rapid-bus', 'local-bus', 'poor']

export const TIER_LABELS: Record<TransitTier, string> = {
  rail: 'Rail-served',
  'rapid-bus': 'Rapid-bus only',
  'local-bus': 'Local-bus only',
  poor: 'Transit-poor',
}

// Hues borrowed from the existing transit-corridor palette so the heat fill
// and the lines drawn on top read as one system.
export const TIER_COLORS: Record<TransitTier, string> = {
  rail: '#1c2438', // navy — BART/rail
  'rapid-bus': '#9a4a31', // sienna — rapid-bus / construction accent
  'local-bus': '#7d9b76', // sage — Muni Metro
  poor: '#a8a29e', // taupe — muted, recedes
}

// Base fill opacity: strongest access reads darkest, transit-poor barely
// tints so it stays background.
export const TIER_BASE_OPACITY: Record<TransitTier, number> = {
  rail: 0.42,
  'rapid-bus': 0.34,
  'local-bus': 0.26,
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
