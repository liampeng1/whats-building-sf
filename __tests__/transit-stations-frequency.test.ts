/**
 * Frequency-driven classifyTier + the supporting combined-frequency helper
 * and grid index. Seeds the module-level arrays directly (same pattern as
 * transit.test.ts) and bumps the freq revision so the cached grid rebuilds.
 */
import {
  combinedBusPeakTph,
  classifyTier,
  buildFreqGrid,
  maxBusTphNear,
  markFreqStopsChanged,
  RAIL_STATIONS,
  FREQ_STOPS,
  VERY_FREQUENT_BUS_TPH,
  FREQUENT_BUS_TPH,
  BASIC_BUS_TPH,
  type FreqStop,
} from '@/lib/transit-stations'

function setFreq(stops: FreqStop[]) {
  FREQ_STOPS.length = 0
  FREQ_STOPS.push(...stops)
  markFreqStopsChanged()
}
function setRail(stations: typeof RAIL_STATIONS) {
  RAIL_STATIONS.length = 0
  RAIL_STATIONS.push(...stations)
}

const AT: [number, number] = [-122.418, 37.752] // [lng, lat] — Mission & 24th-ish

function stopAt(lng: number, lat: number, routes: FreqStop['routes']): FreqStop {
  return { id: `s-${lng}-${lat}`, name: 'Test', lat, lng, routes }
}

beforeEach(() => {
  setRail([])
  setFreq([])
})

describe('combinedBusPeakTph', () => {
  it('sums peak tph across bus routes only (excludes metro + cable car)', () => {
    const stop = stopAt(AT[0], AT[1], [
      { route: '12', mode: 'bus', peakTph: 4, offPeakTph: 3 },
      { route: '49', mode: 'bus', peakTph: 5, offPeakTph: 4 },
      { route: 'J', mode: 'muni-metro', peakTph: 8, offPeakTph: 6 },
      { route: 'PM', mode: 'cable-car', peakTph: 6, offPeakTph: 6 },
    ])
    expect(combinedBusPeakTph(stop)).toBe(9) // 4 + 5
  })
  it('is 0 for a stop with no bus routes', () => {
    expect(combinedBusPeakTph(stopAt(AT[0], AT[1], [{ route: 'K', mode: 'muni-metro', peakTph: 10, offPeakTph: 8 }]))).toBe(0)
  })
})

describe('classifyTier — frequency bands', () => {
  const r = (peakTph: number) => [{ route: 'x', mode: 'bus' as const, peakTph, offPeakTph: 0 }]

  it('rail takes precedence over a very-frequent bus stop', () => {
    setRail([{ id: 'b', name: 'BART', lat: AT[1], lng: AT[0], modes: ['bart'] }])
    setFreq([stopAt(AT[0], AT[1], r(20))])
    expect(classifyTier(AT)).toBe('rail')
  })

  it('≥ 12 tph → very-frequent-bus (boundary)', () => {
    setFreq([stopAt(AT[0], AT[1], r(12))])
    expect(classifyTier(AT)).toBe('very-frequent-bus')
  })
  it('11.9 tph → frequent-bus', () => {
    setFreq([stopAt(AT[0], AT[1], r(11.9))])
    expect(classifyTier(AT)).toBe('frequent-bus')
  })
  it('6 tph → frequent-bus (boundary)', () => {
    setFreq([stopAt(AT[0], AT[1], r(6))])
    expect(classifyTier(AT)).toBe('frequent-bus')
  })
  it('5.9 tph → basic-bus', () => {
    setFreq([stopAt(AT[0], AT[1], r(5.9))])
    expect(classifyTier(AT)).toBe('basic-bus')
  })
  it('2 tph → basic-bus (boundary)', () => {
    setFreq([stopAt(AT[0], AT[1], r(2))])
    expect(classifyTier(AT)).toBe('basic-bus')
  })
  it('1.9 tph → poor', () => {
    setFreq([stopAt(AT[0], AT[1], r(1.9))])
    expect(classifyTier(AT)).toBe('poor')
  })
  it('no stops nearby → poor', () => {
    setFreq([stopAt(-122.5, 37.8, r(20))]) // far away
    expect(classifyTier(AT)).toBe('poor')
  })
  it('uses the BEST (max) combined frequency among nearby stops', () => {
    setFreq([
      stopAt(AT[0], AT[1], r(3)),               // at point: basic
      stopAt(AT[0] + 0.0003, AT[1], r(14)),     // ~26m away: very-frequent
    ])
    expect(classifyTier(AT)).toBe('very-frequent-bus')
  })
  it('returns poor for missing coords', () => {
    expect(classifyTier(null)).toBe('poor')
    expect(classifyTier(undefined)).toBe('poor')
  })

  it('threshold constants match the spec', () => {
    expect([VERY_FREQUENT_BUS_TPH, FREQUENT_BUS_TPH, BASIC_BUS_TPH]).toEqual([12, 6, 2])
  })
})

describe('grid index equals brute force', () => {
  // Deterministic pseudo-random stop field across SF.
  function field(): FreqStop[] {
    const out: FreqStop[] = []
    let seed = 7
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
    for (let i = 0; i < 400; i++) {
      const lat = 37.71 + rnd() * 0.1
      const lng = -122.51 + rnd() * 0.13
      out.push(stopAt(lng, lat, [{ route: 'x', mode: 'bus', peakTph: Math.round(rnd() * 20), offPeakTph: 0 }]))
    }
    return out
  }
  function bruteMaxTph(stops: FreqStop[], lat: number, lng: number, radiusM: number): number {
    let max = 0
    for (const s of stops) {
      const d = Math.hypot((s.lat - lat) * 111320, (s.lng - lng) * 88000)
      if (d <= radiusM) max = Math.max(max, combinedBusPeakTph(s))
    }
    return max
  }
  it('maxBusTphNear matches a brute-force scan at many query points', () => {
    const stops = field()
    const grid = buildFreqGrid(stops, 400)
    let seed = 99
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
    for (let q = 0; q < 60; q++) {
      const lat = 37.71 + rnd() * 0.1
      const lng = -122.51 + rnd() * 0.13
      expect(maxBusTphNear(grid, lat, lng, 400)).toBe(bruteMaxTph(stops, lat, lng, 400))
    }
  })
})
