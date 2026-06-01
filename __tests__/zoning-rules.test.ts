import { ZONING_RULES, getZoningRecord } from '../lib/zoning-rules'
import type { ZoningRecord } from '../lib/zoning-rules'
import { SECTION_URL } from '../lib/zoning-sources'

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
      // legacy records carry parking_min; verified records use parking (RTO only)
      if (r.source.parking_min) {
        expect(r.source.parking_min.section).toMatch(/^§/)
      }
    }
  })

  it('RH-1 has density=1 unit per lot', () => {
    expect(ZONING_RULES['RH-1'].density.units_per_lot).toBe(1)
  })

  it('RH-1 cites §207 for density (verified)', () => {
    expect(ZONING_RULES['RH-1'].source.density?.section).toBe('§207')
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

const verified = () => Object.values(ZONING_RULES).filter((r) => r.verified === true)

describe('verified zoning records', () => {
  it('has at least the 13 residential records', () => {
    expect(verified().length).toBeGreaterThanOrEqual(13)
  })
  it('every digit-form numeric value appears verbatim in its own source quote', () => {
    for (const r of verified()) {
      const checks: Array<[number | undefined, string | undefined]> = [
        [r.density.sqft_per_unit, r.source.density.quote],
        [r.far_non_residential?.max, r.source.far_non_residential?.quote],
        [r.open_space_per_unit?.private_sqft, r.source.open_space?.quote],
        [r.min_lot?.width_ft, r.source.min_lot?.quote],
        [r.min_lot?.area_sqft, r.source.min_lot?.quote],
      ]
      for (const [val, quote] of checks) {
        if (val == null) continue
        // message-arg form of expect() isn't supported by this jest; the
        // toBeTruthy/toContain assertions still enforce the value-in-quote
        // invariant, and the failing record's code is visible in the diff.
        expect(quote).toBeTruthy()
        expect(String(quote)).toContain(String(val))
      }
    }
  })
  it('density sqft_per_unit ramps down RM-1 ≥ RM-2 ≥ RM-3 ≥ RM-4', () => {
    const sf = (c: string) => ZONING_RULES[c].density.sqft_per_unit!
    expect(sf('RM-1')).toBeGreaterThanOrEqual(sf('RM-2'))
    expect(sf('RM-2')).toBeGreaterThanOrEqual(sf('RM-3'))
    expect(sf('RM-3')).toBeGreaterThanOrEqual(sf('RM-4'))
  })
  it('open space ramps down and FAR ramps up across RM density', () => {
    const os = (c: string) => ZONING_RULES[c].open_space_per_unit!.private_sqft
    const far = (c: string) => ZONING_RULES[c].far_non_residential!.max!
    expect(os('RM-1')).toBeGreaterThanOrEqual(os('RM-4'))
    expect(far('RM-1')).toBeLessThanOrEqual(far('RM-4'))
  })
  it('every verified record has name, non-empty density quote, and a document url', () => {
    for (const r of verified()) {
      expect(r.name).toBeTruthy()
      expect(r.source.density.quote).not.toBe('')
      expect(r.source.document_url).toMatch(/^https?:\/\//)
    }
  })
  it('every cited section resolves in SECTION_URL', () => {
    for (const r of verified()) {
      for (const c of Object.values(r.source)) {
        if (c && typeof c === 'object' && 'section' in c) {
          expect(SECTION_URL[(c as { section: string }).section]).toBeDefined()
        }
      }
    }
  })
  it('every verified record has a classification whose section resolves', () => {
    for (const r of verified()) {
      expect(r.classification?.section).toMatch(/^§/)
      expect(SECTION_URL[r.classification!.section]).toBeDefined()
    }
  })
  it('C-3 / C-2 FAR matches Table 124 (POC-corrected values)', () => {
    expect(ZONING_RULES['C-2'].far_non_residential?.max).toBe(3.6)
    expect(ZONING_RULES['C-3-O'].far_non_residential?.max).toBe(9.0)
    expect(ZONING_RULES['C-3-R'].far_non_residential?.max).toBe(6.0)
    expect(ZONING_RULES['C-3-G'].far_non_residential?.max).toBe(6.0)  // was wrongly 9.0
    expect(ZONING_RULES['C-3-S'].far_non_residential?.max).toBe(5.0)  // was wrongly 4.5
  })
})
