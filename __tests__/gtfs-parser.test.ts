import { parseCsv } from '../scripts/sources/_gtfs'

describe('parseCsv', () => {
  it('parses a 2-column CSV with quoted strings', () => {
    const csv = 'stop_id,stop_name\n"70011","San Francisco"\n"70012","22nd St"\n'
    expect(parseCsv(csv)).toEqual([
      { stop_id: '70011', stop_name: 'San Francisco' },
      { stop_id: '70012', stop_name: '22nd St' },
    ])
  })

  it('handles unquoted values', () => {
    const csv = 'a,b,c\n1,2,3\n4,5,6\n'
    expect(parseCsv(csv)).toEqual([
      { a: '1', b: '2', c: '3' },
      { a: '4', b: '5', c: '6' },
    ])
  })

  it('strips a UTF-8 BOM from the start', () => {
    const csv = '﻿stop_id,stop_name\n70011,"San Francisco"\n'
    expect(parseCsv(csv)).toEqual([{ stop_id: '70011', stop_name: 'San Francisco' }])
  })

  it('decodes RFC 4180 escaped quotes ("" inside quoted field)', () => {
    const csv = 'col\n"She said ""Hi"""\n'
    expect(parseCsv(csv)).toEqual([{ col: 'She said "Hi"' }])
  })
})
