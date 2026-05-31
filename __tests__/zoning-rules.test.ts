import { ZONING_RULES, getZoningRecord } from '../lib/zoning-rules'
import type { ZoningRecord } from '../lib/zoning-rules'

describe('ZONING_RULES schema', () => {
  it('includes at least the 5 representative codes', () => {
    expect(Object.keys(ZONING_RULES)).toEqual(
      expect.arrayContaining(['RH-1', 'RH-2', 'RH-3', 'NCT-3', 'C-3-O']),
    )
  })

  it('every record carries per-field source citations and retrieved_at', () => {
    for (const code of Object.keys(ZONING_RULES)) {
      const r = ZONING_RULES[code]
      expect(r.source).toBeDefined()
      expect(r.source.retrieved_at).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      // density is required, so always sourced
      expect(r.source.density?.section).toMatch(/^§/)
      expect(r.source.density?.url).toMatch(/^https?:\/\//)
      expect(r.source.principal_uses?.section).toMatch(/^§/)
      expect(r.source.parking_min?.section).toMatch(/^§/)
    }
  })

  it('RH-1 has density=1 unit per lot', () => {
    expect(ZONING_RULES['RH-1'].density.units_per_lot).toBe(1)
  })

  it('RH-1 cites §209 for density', () => {
    expect(ZONING_RULES['RH-1'].source.density?.section).toBe('§209')
  })

  it('ZoningRecord supports verified fields', () => {
    const r = ZONING_RULES['RH-1'] as ZoningRecord
    void r.verified; void r.name; void r.open_space_per_unit; void r.min_lot
    expect(true).toBe(true)
  })

  it('every record has at least one principal use', () => {
    for (const code of Object.keys(ZONING_RULES)) {
      expect(ZONING_RULES[code].principal_uses.length).toBeGreaterThan(0)
    }
  })
})

describe('getZoningRecord', () => {
  it('returns undefined for unknown code', () => {
    expect(getZoningRecord('NOPE')).toBeUndefined()
  })
  it('returns the RH-1 record', () => {
    expect(getZoningRecord('RH-1')?.code).toBe('RH-1')
  })
})
