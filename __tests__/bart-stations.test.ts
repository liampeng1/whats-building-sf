import { promises as fs } from 'node:fs'
import path from 'node:path'
import { parseBartStops, BART_SF_BBOX } from '../scripts/sources/bart-stations'

const FIX = path.join(__dirname, 'fixtures', 'bart-stops-sample.csv')

describe('bart-stations', () => {
  it('filters BART stops to the SF + Daly City bbox', async () => {
    const csv = await fs.readFile(FIX, 'utf8')
    const out = parseBartStops(csv)
    const names = out.map((s) => s.name).sort()
    expect(names).toEqual([
      'Daly City',
      'Embarcadero',
      'Embarcadero Legacy',
      'Montgomery St.',
      'Powell St.',
    ])
    expect(out.find((s) => s.name === 'Rockridge')).toBeUndefined()
  })

  it('emits station id as a slug', () => {
    const csv = 'stop_id,stop_name,stop_lat,stop_lon,location_type\nEMBR,Embarcadero,37.79,-122.39,0\n'
    const out = parseBartStops(csv)
    expect(out[0].id).toBe('bart-embarcadero')
  })

  it('attaches modes=["bart"] to every station', () => {
    const csv = 'stop_id,stop_name,stop_lat,stop_lon,location_type\nEMBR,Embarcadero,37.79,-122.39,0\n'
    expect(parseBartStops(csv)[0].modes).toEqual(['bart'])
  })

  it('filters out rows with empty stop_name', () => {
    const csv = 'stop_id,stop_name,stop_lat,stop_lon,location_type\nGOOD,Embarcadero,37.79,-122.39,0\nBAD,,37.79,-122.39,0\n'
    expect(parseBartStops(csv)).toHaveLength(1)
  })

  it('filters out rows with non-numeric coordinates', () => {
    const csv = 'stop_id,stop_name,stop_lat,stop_lon\nBAD,Bad Lat,not-a-number,37.79\n'
    expect(parseBartStops(csv)).toHaveLength(0)
  })

  it('filters out entrance/exit rows (location_type=2)', () => {
    const csv =
      'stop_id,stop_name,stop_lat,stop_lon,location_type\n' +
      'EMBR,Embarcadero,37.79,-122.39,0\n' +
      'EMBR_ENT,Embarcadero Entrance,37.792,-122.397,2\n'
    const out = parseBartStops(csv)
    expect(out.map((s) => s.name)).toEqual(['Embarcadero'])
    expect(out.find((s) => s.name === 'Embarcadero Entrance')).toBeUndefined()
  })

  it('rejects location_type=1 (parent stations)', async () => {
    const csv = await fs.readFile(FIX, 'utf8')
    const out = parseBartStops(csv)
    expect(out.find((s) => s.name.includes('parent'))).toBeUndefined()
  })

  it('accepts empty location_type (GTFS spec default = type 0)', async () => {
    const csv = await fs.readFile(FIX, 'utf8')
    const out = parseBartStops(csv)
    expect(out.find((s) => s.name === 'Embarcadero Legacy')).toBeDefined()
  })
})

describe('BART_SF_BBOX', () => {
  it('covers SF + Daly City', () => {
    expect(BART_SF_BBOX.south).toBeLessThanOrEqual(37.706)
    expect(BART_SF_BBOX.north).toBeGreaterThanOrEqual(37.81)
  })
})
