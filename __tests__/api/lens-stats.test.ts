import { computeLensStats, type LensStatsInput } from '@/lib/lens-stats'
import type { Permit } from '@/lib/types'

const samplePermits: Permit[] = [
  // Mission, housing, recent, issued, 6 net units
  { id: 'p1', neighborhood: 'Mission', useCategory: 'housing',
    stage: 'permitted', filedDate: '2025-08-01', issuedDate: '2026-01-15',
    netUnits: 6, location: { type: 'Point', coordinates: [-122.42, 37.76] } } as any,
  // Mission, housing, old (>12mo ago), counts for YoY denominator
  { id: 'p2', neighborhood: 'Mission', useCategory: 'housing',
    stage: 'permitted', filedDate: '2024-07-01', issuedDate: '2024-12-01',
    netUnits: 4, location: { type: 'Point', coordinates: [-122.42, 37.76] } } as any,
  // SoMa, recent
  { id: 'p3', neighborhood: 'South of Market', useCategory: 'housing',
    stage: 'filed', filedDate: '2025-11-01', issuedDate: null,
    netUnits: 12, location: { type: 'Point', coordinates: [-122.40, 37.78] } } as any,
]

describe('computeLensStats', () => {
  const now = new Date('2026-05-11T00:00:00Z')

  it('aggregates per-nhood permit counts and homes', () => {
    const out = computeLensStats({ permits: samplePermits, now } as LensStatsInput)
    expect(out.neighborhoods['Mission'].permits_12mo).toBe(1)
    expect(out.neighborhoods['Mission'].homes_added_12mo).toBe(6)
    expect(out.neighborhoods['South of Market'].permits_12mo).toBe(1)
  })

  it('reports YoY pct change vs same window one year prior', () => {
    const out = computeLensStats({ permits: samplePermits, now })
    // 1 permit this window vs 1 last window = 0% change.
    expect(out.neighborhoods['Mission'].yoy_pct).toBe(0)
  })

  it('reports median filed→permitted days for permits that have issued', () => {
    const out = computeLensStats({ permits: samplePermits, now })
    // p1: filed 2025-08-01, issued 2026-01-15 → 167 days
    expect(out.neighborhoods['Mission'].median_days_to_permit).toBe(167)
  })

  it('returns an empty zoning map when permits lack zoning_category', () => {
    const out = computeLensStats({ permits: samplePermits, now })
    expect(out.zoning).toEqual({})
  })

  it('aggregates by zoning_category when permits carry that field', () => {
    const enriched = samplePermits.map((p, i) => ({
      ...p,
      zoning_category: i === 0 ? 'Mixed Use' : 'Residential',
    }))
    const out = computeLensStats({ permits: enriched as any, now })
    expect(out.zoning['Mixed Use'].permits_share).toBeGreaterThan(0)
  })

  it('aggregates per-transit-tier permit counts when classifier supplied', () => {
    const out = computeLensStats({
      permits: samplePermits, now,
      classifyTier: () => 'rail',
    } as LensStatsInput)
    expect(out.transit_tiers['rail'].permits).toBe(2)
    expect(out.transit_tiers['rail'].homes).toBe(18)
  })

  it('computes top_neighborhoods sorted by count when permits carry zoning_category', () => {
    const enriched = [
      { id: 'p1', neighborhood: 'Mission', filedDate: '2025-09-01',
        netUnits: 1, zoning_category: 'Mixed Use',
        location: { type: 'Point', coordinates: [-122.42, 37.76] } },
      { id: 'p2', neighborhood: 'Mission', filedDate: '2025-10-01',
        netUnits: 2, zoning_category: 'Mixed Use',
        location: { type: 'Point', coordinates: [-122.42, 37.76] } },
      { id: 'p3', neighborhood: 'South of Market', filedDate: '2025-11-01',
        netUnits: 3, zoning_category: 'Mixed Use',
        location: { type: 'Point', coordinates: [-122.40, 37.78] } },
    ] as any
    const out = computeLensStats({ permits: enriched, now: new Date('2026-05-11') })
    expect(out.zoning['Mixed Use'].top_neighborhoods[0]).toBe('Mission')
    expect(out.zoning['Mixed Use'].top_neighborhoods).toContain('South of Market')
  })

  it('computes dominant_zoning per tier from permits with zoning_category', () => {
    const enriched = [
      { id: 'p1', neighborhood: 'Mission', filedDate: '2025-09-01',
        netUnits: 1, zoning_category: 'Mixed Use',
        location: { type: 'Point', coordinates: [-122.42, 37.76] } },
      { id: 'p2', neighborhood: 'Mission', filedDate: '2025-10-01',
        netUnits: 1, zoning_category: 'Residential',
        location: { type: 'Point', coordinates: [-122.42, 37.76] } },
      { id: 'p3', neighborhood: 'Mission', filedDate: '2025-11-01',
        netUnits: 1, zoning_category: 'Mixed Use',
        location: { type: 'Point', coordinates: [-122.42, 37.76] } },
    ] as any
    const out = computeLensStats({
      permits: enriched, now: new Date('2026-05-11'),
      classifyTier: () => 'rail',
    })
    expect(out.transit_tiers['rail'].dominant_zoning).toBe('Mixed Use')
  })
})
