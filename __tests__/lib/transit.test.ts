import {
  isTransitAdjacent,
  distanceMeters,
  TRANSIT_THRESHOLD_M,
} from '@/lib/transit'

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

describe('isTransitAdjacent', () => {
  test('returns false for missing coords', () => {
    expect(isTransitAdjacent(null)).toBe(false)
    expect(isTransitAdjacent(undefined)).toBe(false)
  })
  test('returns false for non-finite coords', () => {
    expect(isTransitAdjacent([NaN, NaN])).toBe(false)
  })
  test('flags points right at a BART entrance as adjacent', () => {
    // 16th & Mission station entrance
    expect(isTransitAdjacent([-122.419698, 37.765222])).toBe(true)
  })
  test('flags a Mission lot two blocks from 24th St BART', () => {
    // Roughly 24th & Bryant — well within the ½-mi shed
    expect(isTransitAdjacent([-122.4106, 37.7517])).toBe(true)
  })
  test('rejects a point in Sea Cliff (no rail nearby)', () => {
    // Sea Cliff is famously transit-poor.
    expect(isTransitAdjacent([-122.4945, 37.7855])).toBe(false)
  })
  test('rejects a point in Lake Merced', () => {
    expect(isTransitAdjacent([-122.4925, 37.7239])).toBe(false)
  })
  test('honours custom threshold parameter', () => {
    // 1m around 16th BART → only the entrance itself qualifies
    expect(isTransitAdjacent([-122.419698, 37.765222], 1)).toBe(true)
    // Move ~10m east → outside a 1m threshold
    expect(isTransitAdjacent([-122.41957, 37.765222], 1)).toBe(false)
  })
  test('default threshold matches the documented ½-mi value (800 m)', () => {
    expect(TRANSIT_THRESHOLD_M).toBe(800)
  })
})
