import { parseHeight } from '../scripts/sources/zoning-heights'

describe('parseHeight', () => {
  it('extracts the numeric foot value from "40-X"', () => {
    expect(parseHeight('40-X')).toEqual({ height_ft: 40, bulk: 'X' })
  })
  it('extracts from "240-S"', () => {
    expect(parseHeight('240-S')).toEqual({ height_ft: 240, bulk: 'S' })
  })
  it('handles no bulk letter ("40")', () => {
    expect(parseHeight('40')).toEqual({ height_ft: 40 })
  })
  it('handles bulk letter with no height ("X")', () => {
    expect(parseHeight('X')).toEqual({ bulk: 'X' })
  })
  it('returns empty on garbage', () => {
    expect(parseHeight('')).toEqual({})
  })
})
