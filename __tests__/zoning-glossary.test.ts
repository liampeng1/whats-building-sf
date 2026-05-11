import { GLOSSARY, getGlossaryEntry } from '../lib/zoning-glossary'

describe('GLOSSARY', () => {
  it('covers the documented terms', () => {
    const terms = Object.keys(GLOSSARY)
    expect(terms).toEqual(expect.arrayContaining([
      'FAR', 'density', 'setback', 'lot coverage', 'principal use', 'ADU', 'bulk control',
    ]))
  })
  it('every entry has a non-empty definition', () => {
    for (const [term, e] of Object.entries(GLOSSARY)) {
      expect(e.definition.length).toBeGreaterThan(10)
      expect(e.term).toBe(term)
    }
  })
})

describe('getGlossaryEntry', () => {
  it('returns undefined for unknown term', () => {
    expect(getGlossaryEntry('nope')).toBeUndefined()
  })
  it('is case-insensitive', () => {
    expect(getGlossaryEntry('far')).toBeDefined()
    expect(getGlossaryEntry('FAR')).toBeDefined()
  })
})
