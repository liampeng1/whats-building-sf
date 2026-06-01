import {
  TIER_ORDER,
  TIER_LABELS,
  TIER_COLORS,
  TIER_BASE_OPACITY,
  tierFillOpacity,
} from '@/lib/transit-tiers-style'

describe('transit-tiers-style', () => {
  it('defines color, label, and base opacity for every tier in order', () => {
    expect(TIER_ORDER).toEqual(['rail', 'rapid-bus', 'local-bus', 'poor'])
    for (const tier of TIER_ORDER) {
      expect(TIER_LABELS[tier]).toBeTruthy()
      expect(TIER_COLORS[tier]).toMatch(/^#[0-9a-f]{6}$/i)
      expect(TIER_BASE_OPACITY[tier]).toBeGreaterThan(0)
    }
  })

  it('opacity decreases with access quality', () => {
    expect(TIER_BASE_OPACITY.rail).toBeGreaterThan(TIER_BASE_OPACITY['rapid-bus'])
    expect(TIER_BASE_OPACITY['rapid-bus']).toBeGreaterThan(TIER_BASE_OPACITY['local-bus'])
    expect(TIER_BASE_OPACITY['local-bus']).toBeGreaterThan(TIER_BASE_OPACITY.poor)
  })

  it('tierFillOpacity returns base opacity when nothing is selected', () => {
    expect(tierFillOpacity('rail', null)).toBe(TIER_BASE_OPACITY.rail)
    expect(tierFillOpacity('poor', null)).toBe(TIER_BASE_OPACITY.poor)
  })

  it('tierFillOpacity brightens the selected tier and dims the rest', () => {
    expect(tierFillOpacity('rail', 'rail')).toBe(0.55)
    expect(tierFillOpacity('poor', 'rail')).toBe(0.04)
    expect(tierFillOpacity('local-bus', 'rail')).toBe(0.04)
  })
})
