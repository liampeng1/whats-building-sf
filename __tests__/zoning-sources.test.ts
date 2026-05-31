import { SECTION_URL, sourced } from '../lib/zoning-sources'

describe('zoning sources', () => {
  it('every SECTION_URL id has the amlegal opaque-id shape', () => {
    for (const [section, id] of Object.entries(SECTION_URL)) {
      expect(section).toMatch(/^§/)
      expect(id).toMatch(/^0-0-0-\d+$/)
    }
  })
  it('sourced() builds a full amlegal url for known sections', () => {
    const c = sourced('§207', 'one dwelling unit per 600 sq.ft. of lot area')
    expect(c.url).toBe('https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_planning/0-0-0-19952')
    expect(c.quote).toContain('600')
  })
  it('falls back to the article root for an unknown section', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    expect(sourced('§999', 'x').url)
      .toBe('https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_planning')
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
  it('resolves the §§209–209.9 range anchor to a real section page', () => {
    expect(sourced('§§209–209.9', 'x').url)
      .toBe('https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_planning/0-0-0-20077')
  })
})
