import {
  TIER_ORDER,
  TIER_LABELS,
  TIER_COLORS,
  TIER_BASE_OPACITY,
  tierFillOpacity,
} from '@/lib/transit-tiers-style'

describe('transit-tiers-style', () => {
  it('defines color, label, and base opacity for every tier in order', () => {
    expect(TIER_ORDER).toEqual([
      'rail',
      'very-frequent-bus',
      'frequent-bus',
      'basic-bus',
      'poor',
    ])
    for (const tier of TIER_ORDER) {
      expect(TIER_LABELS[tier]).toBeTruthy()
      expect(TIER_COLORS[tier]).toMatch(/^#[0-9a-f]{6}$/i)
      expect(TIER_BASE_OPACITY[tier]).toBeGreaterThan(0)
    }
  })

  it('opacity decreases monotonically with access quality', () => {
    for (let i = 1; i < TIER_ORDER.length; i++) {
      expect(TIER_BASE_OPACITY[TIER_ORDER[i - 1]]).toBeGreaterThan(
        TIER_BASE_OPACITY[TIER_ORDER[i]],
      )
    }
  })

  it('tierFillOpacity returns base opacity when nothing is selected', () => {
    expect(tierFillOpacity('rail', null)).toBe(TIER_BASE_OPACITY.rail)
    expect(tierFillOpacity('poor', null)).toBe(TIER_BASE_OPACITY.poor)
  })

  it('tierFillOpacity brightens the selected tier and dims the rest', () => {
    expect(tierFillOpacity('rail', 'rail')).toBe(0.55)
    expect(tierFillOpacity('poor', 'rail')).toBe(0.04)
    expect(tierFillOpacity('frequent-bus', 'rail')).toBe(0.04)
  })
})
