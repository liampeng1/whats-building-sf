import {
  homesShareByTier,
  disparityRatio,
  stageBreakdown,
} from '@/lib/transit-tier-insight'
import type { Permit } from '@/lib/types'
import type { TransitTier } from '@/lib/cross-stats'

// Minimal permit factory — only the fields the insight helpers read.
function permit(
  partial: Partial<Permit> & { coords: [number, number] },
): Permit {
  const { coords, ...rest } = partial
  return {
    permit_number: 'x',
    status: '',
    existing_units: null,
    proposed_units: null,
    proposed_use: null,
    existing_use: null,
    status_date: null,
    location: { type: 'Point', coordinates: coords },
    ...rest,
  } as Permit
}

// Classifier keyed off longitude for deterministic tests:
//  lng 1 → rail, 2 → very-frequent-bus, 3 → frequent-bus, else poor.
const classify = (coords: [number, number] | null | undefined): TransitTier => {
  if (!coords) return 'poor'
  return (
    { 1: 'rail', 2: 'very-frequent-bus', 3: 'frequent-bus' } as Record<number, TransitTier>
  )[coords[0]] ?? 'poor'
}

describe('homesShareByTier', () => {
  it('splits net homes across tiers and sums to 1', () => {
    const permits = [
      permit({ coords: [1, 0], existing_units: '0', proposed_units: '30' }), // rail +30
      permit({ coords: [2, 0], existing_units: '0', proposed_units: '10' }), // rapid +10
      permit({ coords: [9, 0], existing_units: '0', proposed_units: '10' }), // poor +10
    ]
    const share = homesShareByTier(permits, classify)
    expect(share.rail).toBeCloseTo(0.6)
    expect(share['very-frequent-bus']).toBeCloseTo(0.2)
    expect(share.poor).toBeCloseTo(0.2)
    const total =
      share.rail +
      share['very-frequent-bus'] +
      share['frequent-bus'] +
      share['basic-bus'] +
      share.poor
    expect(total).toBeCloseTo(1)
  })

  it('floors negative deltas (demolitions) at 0', () => {
    const permits = [
      permit({ coords: [1, 0], existing_units: '10', proposed_units: '0' }), // -10 → 0
      permit({ coords: [2, 0], existing_units: '0', proposed_units: '5' }), // +5
    ]
    const share = homesShareByTier(permits, classify)
    expect(share.rail).toBe(0)
    expect(share['very-frequent-bus']).toBe(1)
  })

  it('returns all-zero shares when there are no homes', () => {
    const share = homesShareByTier([], classify)
    expect(share.rail).toBe(0)
    expect(share.poor).toBe(0)
  })
})

describe('disparityRatio', () => {
  it('computes homesShare / landShare', () => {
    expect(disparityRatio(0.26, 0.47)).toBeCloseTo(1.81, 1)
    expect(disparityRatio(0.42, 0.11)).toBeCloseTo(0.26, 1)
  })

  it('returns null when landShare is 0', () => {
    expect(disparityRatio(0, 0.5)).toBeNull()
  })
})

describe('stageBreakdown', () => {
  it('groups permits + net homes by stage for the tier, in STAGE_ORDER, omitting empty', () => {
    const permits = [
      // rail, filed (no issued/completed date → filed), +20
      permit({ coords: [1, 0], status: 'filed', proposed_units: '20', existing_units: '0' }),
      // rail, complete, +5
      permit({
        coords: [1, 0], status: 'complete', completed_date: '2025-01-01',
        proposed_units: '5', existing_units: '0',
      }),
      // very-frequent-bus — different tier, excluded
      permit({ coords: [2, 0], status: 'filed', proposed_units: '99', existing_units: '0' }),
    ]
    const out = stageBreakdown(permits, 'rail', classify)
    expect(out.totalPermits).toBe(2)
    expect(out.totalHomes).toBe(25)
    // Only stages with permits appear.
    const stages = out.rows.map((r) => r.stage)
    expect(stages).toContain('filed')
    expect(stages).toContain('complete')
    expect(stages).not.toContain('permitted')
    // STAGE_ORDER: filed before complete.
    expect(stages.indexOf('filed')).toBeLessThan(stages.indexOf('complete'))
    const filed = out.rows.find((r) => r.stage === 'filed')!
    expect(filed.permits).toBe(1)
    expect(filed.homes).toBe(20)
  })

  it('returns empty rows + zero totals for a tier with no permits', () => {
    const out = stageBreakdown([], 'rail', classify)
    expect(out.rows).toEqual([])
    expect(out.totalPermits).toBe(0)
    expect(out.totalHomes).toBe(0)
  })
})
