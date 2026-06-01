import { headwayLabel, routeFreqSummary } from '@/lib/stop-frequency'
import type { RouteFreq } from '@/lib/transit-stations'

describe('headwayLabel', () => {
  it('converts trips/hr to a rounded minute headway', () => {
    expect(headwayLabel(12)).toBe('5 min')
    expect(headwayLabel(6)).toBe('10 min')
    expect(headwayLabel(4)).toBe('15 min')
    expect(headwayLabel(2)).toBe('30 min')
  })
  it('rounds to the nearest minute', () => {
    expect(headwayLabel(8)).toBe('8 min') // 7.5 → 8
  })
  it('shows an em dash for no service', () => {
    expect(headwayLabel(0)).toBe('—')
    expect(headwayLabel(-1)).toBe('—')
  })
})

describe('routeFreqSummary', () => {
  const r = (peakTph: number, offPeakTph: number): RouteFreq => ({
    route: '38R',
    mode: 'bus',
    peakTph,
    offPeakTph,
  })
  it('shows peak and midday headways when both run', () => {
    expect(routeFreqSummary(r(10, 6))).toBe('6 min peak / 10 min midday')
  })
  it('marks peak-only routes (express)', () => {
    expect(routeFreqSummary(r(8, 0))).toBe('8 min peak · peak only')
  })
  it('shows midday only when there is no peak service', () => {
    expect(routeFreqSummary(r(0, 4))).toBe('15 min midday')
  })
  it('says no service when neither window runs', () => {
    expect(routeFreqSummary(r(0, 0))).toBe('no service')
  })
})
