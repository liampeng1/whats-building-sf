import { SF_HEIGHT_REFERENCES } from '../lib/sf-height-references'

describe('SF_HEIGHT_REFERENCES', () => {
  it('contains at least 10 entries', () => {
    expect(SF_HEIGHT_REFERENCES.length).toBeGreaterThanOrEqual(10)
  })
  it('each entry has name, height_ft, category, illustration, width_px, source', () => {
    for (const r of SF_HEIGHT_REFERENCES) {
      expect(r.name).toBeTruthy()
      expect(r.height_ft).toBeGreaterThan(0)
      expect(['human', 'residential', 'civic', 'tower']).toContain(r.category)
      expect(r.illustration).toMatch(/^<svg.*<\/svg>$/s)
      expect(r.width_px).toBeGreaterThan(0)
      expect(r.source).toBeTruthy()
    }
  })
  it('includes the cornerstone landmarks', () => {
    const names = SF_HEIGHT_REFERENCES.map((r) => r.name)
    expect(names).toEqual(expect.arrayContaining([
      'Person', 'Coit Tower', 'Transamerica Pyramid', 'Salesforce Tower',
    ]))
  })
})
