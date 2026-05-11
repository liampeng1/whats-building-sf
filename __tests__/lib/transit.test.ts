/**
 * Legacy tests for transit-adjacency helpers, now backed by
 * lib/transit-stations.ts. The location-specific tests seed the module
 * with the same stations the old lib/transit.ts had hard-coded.
 */

import {
  distanceMeters,
  RAIL_THRESHOLD_M,
} from '@/lib/transit-stations'

// Seed the module with the stations that the old lib/transit.ts had
// hard-coded, so the location-based assertions still hold.
function withLegacyStations() {
  let mod: typeof import('../../lib/transit-stations')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  jest.isolateModules(() => { mod = require('../../lib/transit-stations') })
  mod!.RAIL_STATIONS.length = 0
  mod!.RAIL_STATIONS.push(
    { id: 'bart-embarcadero',  name: 'Embarcadero',          lat: 37.792976, lng: -122.396957, modes: ['bart'] },
    { id: 'bart-montgomery',   name: 'Montgomery St',         lat: 37.789256, lng: -122.401407, modes: ['bart'] },
    { id: 'bart-powell',       name: 'Powell St',             lat: 37.784471, lng: -122.40798,  modes: ['bart'] },
    { id: 'bart-civic-center', name: 'Civic Center / UN Plaza', lat: 37.779528, lng: -122.413756, modes: ['bart'] },
    { id: 'bart-16th-mission', name: '16th St / Mission',    lat: 37.765222, lng: -122.419698, modes: ['bart'] },
    { id: 'bart-24th-mission', name: '24th St / Mission',    lat: 37.752254, lng: -122.418466, modes: ['bart'] },
    { id: 'bart-glen-park',    name: 'Glen Park',             lat: 37.733118, lng: -122.43399,  modes: ['bart'] },
    { id: 'bart-balboa-park',  name: 'Balboa Park',           lat: 37.721617, lng: -122.447506, modes: ['bart'] },
    { id: 'bart-daly-city',    name: 'Daly City',             lat: 37.706121, lng: -122.469081, modes: ['bart'] },
  )
  return mod!
}

describe('distanceMeters', () => {
  test('zero distance for the same point', () => {
    expect(distanceMeters(37.78, -122.42, 37.78, -122.42)).toBe(0)
  })
  test('approximate distance between Embarcadero and Powell BART (~1.0 km)', () => {
    // Embarcadero ↔ Powell BART is about 800 m as the crow flies.
    const d = distanceMeters(37.792976, -122.396957, 37.784471, -122.40798)
    expect(d).toBeGreaterThan(700)
    expect(d).toBeLessThan(1500)
  })
  test('symmetry — order does not matter', () => {
    const a = distanceMeters(37.7, -122.4, 37.8, -122.5)
    const b = distanceMeters(37.8, -122.5, 37.7, -122.4)
    expect(Math.abs(a - b)).toBeLessThan(0.001)
  })
})

describe('transitAdjacent (was isTransitAdjacent)', () => {
  const m = withLegacyStations()

  test('returns false for missing coords', () => {
    expect(m.transitAdjacent(null)).toBe(false)
    expect(m.transitAdjacent(undefined)).toBe(false)
  })
  test('returns false for non-finite coords', () => {
    expect(m.transitAdjacent([NaN, NaN])).toBe(false)
  })
  test('flags points right at a BART entrance as adjacent', () => {
    // 16th & Mission station entrance
    expect(m.transitAdjacent([-122.419698, 37.765222])).toBe(true)
  })
  test('flags a Mission lot two blocks from 24th St BART', () => {
    // Roughly 24th & Bryant — well within the ½-mi shed
    expect(m.transitAdjacent([-122.4106, 37.7517])).toBe(true)
  })
  test('rejects a point in Sea Cliff (no rail nearby)', () => {
    // Sea Cliff is famously transit-poor.
    expect(m.transitAdjacent([-122.4945, 37.7855])).toBe(false)
  })
  test('rejects a point in Lake Merced', () => {
    expect(m.transitAdjacent([-122.4925, 37.7239])).toBe(false)
  })
  test('honours custom threshold via railThresholdM option', () => {
    // 1m around 16th BART → only the entrance itself qualifies
    expect(m.transitAdjacent([-122.419698, 37.765222], { railThresholdM: 1 })).toBe(true)
    // Move ~10m east → outside a 1m threshold
    expect(m.transitAdjacent([-122.41957, 37.765222], { railThresholdM: 1 })).toBe(false)
  })
  test('default threshold matches the documented ½-mi value (800 m)', () => {
    expect(RAIL_THRESHOLD_M).toBe(800)
  })
})
