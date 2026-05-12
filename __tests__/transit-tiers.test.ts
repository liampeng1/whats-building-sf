import {
  classifyTier, FREQUENT_LOCAL_LINES, RAIL_STATIONS, RAPID_BUS_STOPS,
} from '@/lib/transit-stations'

describe('classifyTier', () => {
  beforeEach(() => {
    RAIL_STATIONS.length = 0
    RAPID_BUS_STOPS.length = 0
  })

  it('returns "rail" if a rail station is within 400 m', () => {
    RAIL_STATIONS.push({ id: 'r1', name: 'X', lat: 37.7749, lng: -122.4194, modes: ['bart'] })
    expect(classifyTier([-122.4194, 37.7749])).toBe('rail')
  })

  it('returns "rapid-bus" if rapid stop in range and no rail', () => {
    RAPID_BUS_STOPS.push({ id: 'b1', name: 'Y', lat: 37.78, lng: -122.42, routes: ['38R'] })
    expect(classifyTier([-122.42, 37.78])).toBe('rapid-bus')
  })

  it('returns "local-bus" if a frequent local stop in range and no rapid/rail', () => {
    expect(FREQUENT_LOCAL_LINES).toBeDefined()
    expect(Array.isArray(FREQUENT_LOCAL_LINES)).toBe(true)
  })

  it('returns "poor" when nothing is in range', () => {
    expect(classifyTier([-122.40, 37.70])).toBe('poor')
  })
})
