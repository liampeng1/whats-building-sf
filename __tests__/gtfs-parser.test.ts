import { parseCsv, parseShapes } from '../scripts/sources/_gtfs'

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

describe('parseShapes', () => {
  it('groups points by shape_id and sorts by sequence', () => {
    const csv = `shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence
S1,37.79,-122.40,1
S1,37.80,-122.41,2
S2,37.70,-122.45,1
S1,37.81,-122.42,3
`
    const out = parseShapes(csv)
    expect(out.size).toBe(2)
    expect(out.get('S1')).toEqual([
      [-122.40, 37.79],
      [-122.41, 37.80],
      [-122.42, 37.81],
    ])
    expect(out.get('S2')).toEqual([
      [-122.45, 37.70],
    ])
  })

  it('returns coordinates as [lng, lat] pairs (GeoJSON convention)', () => {
    const csv = `shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence
A,37.0,-122.0,1
`
    const out = parseShapes(csv)
    expect(out.get('A')).toEqual([[-122.0, 37.0]])
  })
})
