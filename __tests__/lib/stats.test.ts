import { computeStats, computeNeighborhoodStats } from '@/lib/stats'
import type { Permit } from '@/lib/types'
import type { FeatureCollection, Polygon } from 'geojson'

function permit(overrides: Partial<Permit> = {}): Permit {
  return {
    permit_number: 'X',
    permit_type: '1',
    permit_type_definition: 'new construction',
    status: 'filed',
    description: null,
    address: '123 Main St',
    filed_date: null,
    issued_date: null,
    completed_date: null,
    status_date: null,
    estimated_cost: null,
    existing_use: null,
    proposed_use: null,
    existing_units: null,
    proposed_units: null,
    existing_stories: null,
    proposed_stories: null,
    location: null,
    pipeline_status: null,
    pipeline_status_date: null,
    block: null,
    lot: null,
    ...overrides,
  }
}

const NOW = new Date('2026-05-09').getTime()

test('counts total tracked permits', () => {
  const s = computeStats([permit({ permit_number: 'A' }), permit({ permit_number: 'B' })], NOW)
  expect(s.totalTracked).toBe(2)
})

test('computes filed→issued median in days, ignoring missing data', () => {
  const s = computeStats(
    [
      permit({
        permit_number: 'fast',
        filed_date: '2024-01-01',
        issued_date: '2024-04-01', // 91 days
        status: 'issued',
      }),
      permit({
        permit_number: 'slow',
        filed_date: '2024-01-01',
        issued_date: '2025-01-01', // 366 days
        status: 'issued',
      }),
      permit({
        permit_number: 'no-issue',
        filed_date: '2024-01-01',
        issued_date: null,
        status: 'filed',
      }),
    ],
    NOW,
  )
  expect(s.filedToIssuedSampleSize).toBe(2)
  expect(s.filedToIssuedMedian).toBeGreaterThan(0)
  // Median of [91, 366] picks one of the two — implementation uses the
  // upper of the two when sample size is even.
  expect([91, 366]).toContain(s.filedToIssuedMedian)
})

test('flags stalled approved/permitted permits past 365d', () => {
  // status_date well over a year ago → stalled
  const stalled = permit({
    permit_number: 'stalled',
    status: 'issued',
    issued_date: '2023-01-01',
    status_date: '2023-01-01',
  })
  // recently issued → not stalled
  const fresh = permit({
    permit_number: 'fresh',
    status: 'issued',
    issued_date: '2026-01-01',
    status_date: '2026-01-01',
  })
  const s = computeStats([stalled, fresh], NOW)
  const ids = s.stalled.map((row) => row.permit.permit_number)
  expect(ids).toContain('stalled')
  expect(ids).not.toContain('fresh')
})

test('only ranks 10 stalled entries even when more match', () => {
  const many = Array.from({ length: 15 }, (_, i) =>
    permit({
      permit_number: `S${i}`,
      status: 'issued',
      issued_date: '2022-01-01',
      status_date: `2022-${String((i % 12) + 1).padStart(2, '0')}-01`,
    }),
  )
  const s = computeStats(many, NOW)
  expect(s.stalled.length).toBeLessThanOrEqual(10)
})

test('sums RHNA delivered units from completed permits since cycle start', () => {
  const s = computeStats(
    [
      permit({
        permit_number: 'delivered',
        status: 'complete',
        existing_units: '0',
        proposed_units: '50',
        completed_date: '2024-06-01',
      }),
      // before cycle — should NOT count
      permit({
        permit_number: 'pre-cycle',
        status: 'complete',
        existing_units: '0',
        proposed_units: '100',
        completed_date: '2022-06-01',
      }),
    ],
    NOW,
  )
  expect(s.rhnaUnitsDelivered).toBe(50)
  expect(s.rhnaTarget).toBe(82069)
})

test('aggregates filings by year', () => {
  const s = computeStats(
    [
      permit({ permit_number: 'a', filed_date: '2024-03-01' }),
      permit({ permit_number: 'b', filed_date: '2024-06-15' }),
      permit({ permit_number: 'c', filed_date: '2023-12-01' }),
    ],
    NOW,
  )
  const y2024 = s.filingsByYear.find((r) => r.year === 2024)
  expect(y2024?.count).toBe(2)
  const y2023 = s.filingsByYear.find((r) => r.year === 2023)
  expect(y2023?.count).toBe(1)
})

describe('computeNeighborhoodStats', () => {
  // Two synthetic SF neighborhoods: a unit square around Mission and another
  // around Sunset. Coordinates are fake but contiguous and disjoint.
  const geo: FeatureCollection<Polygon, { nhood: string }> = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { nhood: 'Mission' },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [-122.43, 37.74],
            [-122.41, 37.74],
            [-122.41, 37.77],
            [-122.43, 37.77],
            [-122.43, 37.74],
          ]],
        },
      },
      {
        type: 'Feature',
        properties: { nhood: 'Sunset' },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [-122.51, 37.74],
            [-122.46, 37.74],
            [-122.46, 37.77],
            [-122.51, 37.77],
            [-122.51, 37.74],
          ]],
        },
      },
    ],
  }

  test('assigns permits to the correct neighborhood and aggregates units', () => {
    const permits: Permit[] = [
      permit({
        permit_number: 'mission-1',
        existing_units: '0',
        proposed_units: '50',
        status: 'issued',
        location: { type: 'Point', coordinates: [-122.42, 37.755] },
      }),
      permit({
        permit_number: 'sunset-1',
        existing_units: '0',
        proposed_units: '20',
        status: 'filed',
        location: { type: 'Point', coordinates: [-122.485, 37.755] },
      }),
    ]
    const stats = computeNeighborhoodStats(permits, geo, NOW)
    const mission = stats.find((r) => r.nhood === 'Mission')
    const sunset = stats.find((r) => r.nhood === 'Sunset')
    expect(mission?.active).toBe(1)
    expect(mission?.unitsInPipeline).toBe(50)
    expect(sunset?.active).toBe(1)
    expect(sunset?.unitsInPipeline).toBe(20)
  })

  test('sorts by unitsInPipeline descending', () => {
    const permits: Permit[] = [
      permit({
        permit_number: 'sunset-big',
        existing_units: '0',
        proposed_units: '200',
        status: 'issued',
        location: { type: 'Point', coordinates: [-122.485, 37.755] },
      }),
      permit({
        permit_number: 'mission-small',
        existing_units: '0',
        proposed_units: '5',
        status: 'issued',
        location: { type: 'Point', coordinates: [-122.42, 37.755] },
      }),
    ]
    const stats = computeNeighborhoodStats(permits, geo, NOW)
    expect(stats[0].nhood).toBe('Sunset')
    expect(stats[1].nhood).toBe('Mission')
  })

  test('skips inactive permits', () => {
    const permits: Permit[] = [
      permit({
        permit_number: 'cancelled',
        existing_units: '0',
        proposed_units: '50',
        status: 'cancelled',
        location: { type: 'Point', coordinates: [-122.42, 37.755] },
      }),
    ]
    const stats = computeNeighborhoodStats(permits, geo, NOW)
    expect(stats.find((r) => r.nhood === 'Mission')?.active).toBe(0)
  })
})

test('counts under construction by Pipeline status', () => {
  const s = computeStats(
    [
      permit({
        permit_number: 'building',
        status: 'issued',
        issued_date: '2024-01-01',
        proposed_units: '20',
        existing_units: '0',
        pipeline_status: 'Construction',
        pipeline_status_date: '2025-06-01',
      }),
      permit({
        permit_number: 'sitting',
        status: 'issued',
        issued_date: '2024-01-01',
      }),
    ],
    NOW,
  )
  expect(s.underConstruction).toBe(1)
  expect(s.unitsUnderConstruction).toBe(20)
})
