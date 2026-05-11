import { SPECIAL_ZONING_AREAS } from '../lib/special-zoning-areas'

describe('SPECIAL_ZONING_AREAS', () => {
  it('includes at least 3 hand-listed areas with required fields', () => {
    expect(SPECIAL_ZONING_AREAS.length).toBeGreaterThanOrEqual(3)
    for (const a of SPECIAL_ZONING_AREAS) {
      expect(a.name).toBeTruthy()
      expect(a.governor).toBeTruthy()
      expect(a.note).toBeTruthy()
      expect(a.source.url).toMatch(/^https?:\/\//)
      expect(a.source.cite).toBeTruthy()
      expect(a.shape).toBeDefined()
      expect(['Polygon', 'MultiPolygon']).toContain(a.shape.type)
    }
  })
  it('includes the Presidio', () => {
    expect(SPECIAL_ZONING_AREAS.find((a) => a.name === 'Presidio')).toBeDefined()
  })
  it('includes Treasure Island / Yerba Buena Island', () => {
    expect(SPECIAL_ZONING_AREAS.find((a) => a.name.toLowerCase().includes('treasure'))).toBeDefined()
  })
})
