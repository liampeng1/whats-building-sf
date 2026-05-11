import { getZoningBlurb } from '../lib/zoning-blurbs'

describe('getZoningBlurb', () => {
  it('returns a string for each top-level gen', () => {
    for (const gen of ['Residential', 'Mixed Use', 'Commercial', 'Industrial', 'Public', 'Other']) {
      const b = getZoningBlurb(gen)
      expect(typeof b).toBe('string')
      expect(b.length).toBeGreaterThan(20)
    }
  })
  it('returns an empty string for an unknown gen', () => {
    expect(getZoningBlurb('Mars')).toBe('')
  })
})
