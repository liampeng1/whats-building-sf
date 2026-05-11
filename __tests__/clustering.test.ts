import {
  PIN_FADE_MIN,
  PIN_FADE_MAX,
  pinOpacity,
  clusterOpacity,
} from '../lib/zoom-fade'

describe('pinOpacity', () => {
  it('is 0 at or below PIN_FADE_MIN', () => {
    expect(pinOpacity(PIN_FADE_MIN)).toBe(0)
    expect(pinOpacity(10)).toBe(0)
  })
  it('is 1 at or above PIN_FADE_MAX', () => {
    expect(pinOpacity(PIN_FADE_MAX)).toBe(1)
    expect(pinOpacity(18)).toBe(1)
  })
  it('ramps linearly across the fade band', () => {
    const mid = (PIN_FADE_MIN + PIN_FADE_MAX) / 2
    expect(pinOpacity(mid)).toBeCloseTo(0.5, 2)
  })
})

describe('clusterOpacity', () => {
  it('is 1 at or below PIN_FADE_MIN', () => {
    expect(clusterOpacity(PIN_FADE_MIN)).toBe(1)
    expect(clusterOpacity(10)).toBe(1)
  })
  it('is 0 at or above PIN_FADE_MAX', () => {
    expect(clusterOpacity(PIN_FADE_MAX)).toBe(0)
    expect(clusterOpacity(18)).toBe(0)
  })
  it('is the mirror of pinOpacity across the fade band', () => {
    for (const z of [13.6, 13.8, 14.0, 14.2, 14.4]) {
      expect(clusterOpacity(z) + pinOpacity(z)).toBeCloseTo(1, 5)
    }
  })
})
