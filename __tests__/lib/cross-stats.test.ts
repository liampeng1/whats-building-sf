import type { CrossStats, NhoodStats, ZoningStats, TierStats } from '@/lib/cross-stats'

describe('CrossStats type', () => {
  it('NhoodStats has near_rail_pct', () => {
    const n: NhoodStats = {
      nhood: 'X', area_sqm: 1000,
      zoning_share: {}, transit_coverage: { '0.1mi': 0, '0.25mi': 0 },
      near_rail_pct: 0.5,
    }
    expect(n.near_rail_pct).toBe(0.5)
  })

  it('ZoningStats has districts[]', () => {
    const z: ZoningStats = {
      category: 'Residential',
      area_sqm: 1, share_of_sf: 1,
      neighborhood_share: {}, transit_coverage: { '0.1mi': 0, '0.25mi': 0 },
      districts: [{ code: 'RH-1', name: 'Single-family', description: 'x', land_share_within_cat: 0.5 }],
    }
    expect(z.districts).toHaveLength(1)
  })

  it('CrossStats includes transit_tiers', () => {
    const c: Pick<CrossStats, 'transit_tiers'> = {
      transit_tiers: [
        { tier: 'rail', area_sqm: 1, share_of_sf: 0.08 },
        { tier: 'rapid-bus', area_sqm: 1, share_of_sf: 0.18 },
        { tier: 'local-bus', area_sqm: 1, share_of_sf: 0.52 },
        { tier: 'poor', area_sqm: 1, share_of_sf: 0.22 },
      ] as TierStats[],
    }
    expect(c.transit_tiers).toHaveLength(4)
  })
})
