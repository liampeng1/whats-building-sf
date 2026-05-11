/**
 * @jest-environment jsdom
 */
import {
  distanceMeters,
  RAIL_THRESHOLD_M,
  RAPID_BUS_THRESHOLD_M,
} from '../lib/transit-stations'

// Use jest.isolateModules to seed each test with fresh module state and
// pre-populated station arrays.
function withStations(
  rail: { id: string; name: string; lat: number; lng: number; modes: ('bart' | 'muni-metro' | 'caltrain')[] }[],
  rapid: { id: string; name: string; lat: number; lng: number; routes: string[] }[],
) {
  let mod: typeof import('../lib/transit-stations')
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('../lib/transit-stations')
    // Mutate the exported arrays directly. The module exports `let`-bindings
    // intentionally for runtime hydration, so this seeds them as a test fixture.
    mod.RAIL_STATIONS.length = 0
    mod.RAIL_STATIONS.push(...rail)
    mod.RAPID_BUS_STOPS.length = 0
    mod.RAPID_BUS_STOPS.push(...rapid)
  })
  return mod!
}

describe('distanceMeters', () => {
  it('returns 0 for the same point', () => {
    expect(distanceMeters(37.7, -122.4, 37.7, -122.4)).toBe(0)
  })
  it('measures ~111km per degree of latitude', () => {
    const d = distanceMeters(37.0, -122.4, 38.0, -122.4)
    expect(d).toBeGreaterThan(110000)
    expect(d).toBeLessThan(112000)
  })
})

describe('railShed', () => {
  const m = withStations(
    [{ id: 'bart-embarcadero', name: 'Embarcadero', lat: 37.792976, lng: -122.396957, modes: ['bart'] }],
    [],
  )
  it('returns true within 400m of Embarcadero BART', () => {
    expect(m.railShed([-122.397, 37.793])).toBe(true)
  })
  it('returns false 5km from any rail station', () => {
    expect(m.railShed([-122.45, 37.78])).toBe(false)
  })
  it('respects a custom threshold', () => {
    expect(m.railShed([-122.397, 37.793], 10)).toBe(true)
  })
})

describe('rapidBusShed', () => {
  const m = withStations(
    [],
    [{ id: 'bus-geary-powell', name: 'Geary & Powell', lat: 37.787, lng: -122.408, routes: ['38R'] }],
  )
  it('returns true within default 160m of a rapid bus stop', () => {
    expect(m.rapidBusShed([-122.408, 37.787])).toBe(true)
  })
  it('returns false at 500m', () => {
    expect(m.rapidBusShed([-122.413, 37.787])).toBe(false)
  })
})

describe('transitAdjacent', () => {
  const m = withStations(
    [{ id: 'bart-embarcadero', name: 'Embarcadero', lat: 37.792976, lng: -122.396957, modes: ['bart'] }],
    [{ id: 'bus-geary-powell', name: 'Geary & Powell', lat: 37.787, lng: -122.408, routes: ['38R'] }],
  )
  it('defaults to rail-only', () => {
    expect(m.transitAdjacent([-122.397, 37.793])).toBe(true)
    expect(m.transitAdjacent([-122.408, 37.787])).toBe(false)
  })
  it('accepts rapidBus opt-in', () => {
    expect(m.transitAdjacent([-122.408, 37.787], { rail: false, rapidBus: true })).toBe(true)
  })
})

describe('withinStationRadius', () => {
  it('checks haversine distance against a single station', () => {
    const station = { lat: 37.793, lng: -122.397 }
    // The helper takes coords as [lng, lat]
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { withinStationRadius } = require('../lib/transit-stations')
    expect(withinStationRadius([-122.397, 37.793], station, 10)).toBe(true)
    expect(withinStationRadius([-122.45, 37.78], station, 800)).toBe(false)
  })
})

describe('thresholds', () => {
  it('exports the documented walk-shed defaults', () => {
    expect(RAIL_THRESHOLD_M).toBe(400)
    expect(RAPID_BUS_THRESHOLD_M).toBe(160)
  })
})
