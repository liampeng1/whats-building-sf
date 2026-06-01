import { computeLensStats } from '@/lib/lens-stats'
import type { TransitTier } from '@/lib/cross-stats'

// Enriched-shape permit stub — computeLensStats reads camelCase fields via
// `as any`. Only the fields the tier loop touches are set.
function ep(opts: {
  lng: number
  filedDate: string
  useCategory: string
  netUnits?: number
}) {
  return {
    permit_number: 'p',
    location: { type: 'Point', coordinates: [opts.lng, 0] },
    filedDate: opts.filedDate,
    useCategory: opts.useCategory,
    netUnits: opts.netUnits ?? 0,
  } as any
}

// lng 1 → rail, else poor.
const classifyTier = (coords: [number, number]): TransitTier =>
  coords[0] === 1 ? 'rail' : 'poor'

describe('computeLensStats — transit tier use_mix', () => {
  const now = new Date('2025-06-01')
  const recent = '2025-03-01' // inside trailing 12mo

  it('normalizes use mix to shares within each tier', () => {
    const permits = [
      ep({ lng: 1, filedDate: recent, useCategory: 'housing' }),
      ep({ lng: 1, filedDate: recent, useCategory: 'housing' }),
      ep({ lng: 1, filedDate: recent, useCategory: 'retail' }),
    ]
    const out = computeLensStats({ permits, now, classifyTier })
    const rail = out.transit_tiers.rail
    expect(rail.use_mix.housing).toBeCloseTo(2 / 3)
    expect(rail.use_mix.retail).toBeCloseTo(1 / 3)
    const sum = Object.values(rail.use_mix).reduce((a, b) => a + (b ?? 0), 0)
    expect(sum).toBeCloseTo(1)
  })

  it('leaves use_mix empty for tiers with no permits', () => {
    const out = computeLensStats({
      permits: [ep({ lng: 1, filedDate: recent, useCategory: 'housing' })],
      now,
      classifyTier,
    })
    expect(out.transit_tiers.poor.use_mix).toEqual({})
  })
})
