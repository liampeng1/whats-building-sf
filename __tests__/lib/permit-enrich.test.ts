import { enrichPermit, type NhoodFeatureCollection } from '@/lib/permit-enrich'
import type { Permit } from '@/lib/types'

// Tiny fake nhood GeoJSON — a 0.01-deg square around (37.76, -122.42) labeled
// "Mission". Coordinates are GeoJSON [lng, lat] order. The polygon ring
// closes on itself (first == last).
const fakeNhoodGeo: NhoodFeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { nhood: 'Mission' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-122.425, 37.755],
            [-122.415, 37.755],
            [-122.415, 37.765],
            [-122.425, 37.765],
            [-122.425, 37.755],
          ],
        ],
      },
    },
  ],
}

function makePermit(over: Partial<Permit> = {}): Permit {
  const base: Permit = {
    permit_number: '2026.0001',
    permit_type: '1',
    permit_type_definition: 'new construction',
    status: 'filed',
    description: null,
    address: '100 Test St',
    filed_date: '2025-09-01',
    issued_date: '2025-12-01',
    completed_date: null,
    status_date: null,
    estimated_cost: null,
    existing_use: null,
    proposed_use: '1 family dwelling',
    existing_units: '0',
    proposed_units: '6',
    existing_stories: null,
    proposed_stories: null,
    location: { type: 'Point', coordinates: [-122.42, 37.76] },
    pipeline_status: null,
    pipeline_status_date: null,
    block: null,
    lot: null,
  }
  return { ...base, ...over }
}

describe('enrichPermit', () => {
  it('maps filed_date → filedDate and issued_date → issuedDate', () => {
    const out = enrichPermit(makePermit(), fakeNhoodGeo)
    expect(out.filedDate).toBe('2025-09-01')
    expect(out.issuedDate).toBe('2025-12-01')
  })

  it('computes netUnits = proposed - existing', () => {
    const out = enrichPermit(
      makePermit({ existing_units: '2', proposed_units: '10' }),
      fakeNhoodGeo,
    )
    expect(out.netUnits).toBe(8)
  })

  it('defaults missing existing/proposed values to 0', () => {
    const out = enrichPermit(
      makePermit({ existing_units: null, proposed_units: null }),
      fakeNhoodGeo,
    )
    expect(out.netUnits).toBe(0)

    const out2 = enrichPermit(
      makePermit({ existing_units: null, proposed_units: '4' }),
      fakeNhoodGeo,
    )
    expect(out2.netUnits).toBe(4)
  })

  it('assigns neighborhood via PIP when the permit falls inside a polygon', () => {
    const out = enrichPermit(
      makePermit({ location: { type: 'Point', coordinates: [-122.42, 37.76] } }),
      fakeNhoodGeo,
    )
    expect(out.neighborhood).toBe('Mission')
  })

  it('returns null neighborhood for a permit with no location', () => {
    const out = enrichPermit(makePermit({ location: null }), fakeNhoodGeo)
    expect(out.neighborhood).toBeNull()
  })

  it('returns null neighborhood when the point falls outside every polygon', () => {
    const out = enrichPermit(
      makePermit({ location: { type: 'Point', coordinates: [-122.50, 37.80] } }),
      fakeNhoodGeo,
    )
    expect(out.neighborhood).toBeNull()
  })

  it('derives useCategory from proposed_use (housing)', () => {
    const out = enrichPermit(
      makePermit({ proposed_use: '1 family dwelling' }),
      fakeNhoodGeo,
    )
    expect(out.useCategory).toBe('housing')
  })

  it('derives useCategory for office', () => {
    const out = enrichPermit(
      makePermit({ proposed_use: 'office' }),
      fakeNhoodGeo,
    )
    expect(out.useCategory).toBe('office')
  })

  it('falls back to "other" when proposed_use is null', () => {
    const out = enrichPermit(
      makePermit({ proposed_use: null }),
      fakeNhoodGeo,
    )
    expect(out.useCategory).toBe('other')
  })

  it('derives stage from the whole permit (pipeline_status wins)', () => {
    const out = enrichPermit(
      makePermit({ status: 'filed', pipeline_status: 'Construction' }),
      fakeNhoodGeo,
    )
    expect(out.stage).toBe('construction')
  })

  it('falls back to status mapping when pipeline_status is absent', () => {
    const out = enrichPermit(
      makePermit({ status: 'issued', pipeline_status: null }),
      fakeNhoodGeo,
    )
    expect(out.stage).toBe('permitted')
  })

  it('passes through permit_number and location', () => {
    const loc: Permit['location'] = { type: 'Point', coordinates: [-122.42, 37.76] }
    const out = enrichPermit(makePermit({ permit_number: 'X-99', location: loc }), fakeNhoodGeo)
    expect(out.permit_number).toBe('X-99')
    expect(out.location).toEqual(loc)
  })
})
