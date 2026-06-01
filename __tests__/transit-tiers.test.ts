import {
  classifyTier,
  markFreqStopsChanged,
  RAIL_STATIONS,
  FREQ_STOPS,
  type FreqStop,
} from '@/lib/transit-stations'

// Detailed band-boundary + grid coverage lives in
// transit-stations-frequency.test.ts; this file pins the high-level
// rail-precedence / frequency-band / poor behavior of classifyTier.
function busStop(lat: number, lng: number, peakTph: number): FreqStop {
  return {
    id: `s-${lat}-${lng}`,
    name: 'Y',
    lat,
    lng,
    routes: [{ route: '38', mode: 'bus', peakTph, offPeakTph: 0 }],
  }
}

describe('classifyTier', () => {
  beforeEach(() => {
    RAIL_STATIONS.length = 0
    FREQ_STOPS.length = 0
    markFreqStopsChanged()
  })

  it('returns "rail" if a rail station is within 400 m', () => {
    RAIL_STATIONS.push({ id: 'r1', name: 'X', lat: 37.7749, lng: -122.4194, modes: ['bart'] })
    expect(classifyTier([-122.4194, 37.7749])).toBe('rail')
  })

  it('returns a frequency band from the nearest bus stop when no rail', () => {
    FREQ_STOPS.push(busStop(37.78, -122.42, 7))
    markFreqStopsChanged()
    expect(classifyTier([-122.42, 37.78])).toBe('frequent-bus')
  })

  it('returns "poor" when nothing is in range', () => {
    expect(classifyTier([-122.4, 37.7])).toBe('poor')
  })
})
