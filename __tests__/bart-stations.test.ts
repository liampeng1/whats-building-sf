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
      'Montgomery St.',
      'Powell St.',
    ])
    expect(out.find((s) => s.name === 'Rockridge')).toBeUndefined()
  })

  it('emits station id as a slug', () => {
    const csv = 'stop_id,stop_name,stop_lat,stop_lon\nEMBR,Embarcadero,37.79,-122.39\n'
    const out = parseBartStops(csv)
    expect(out[0].id).toBe('bart-embarcadero')
  })

  it('attaches modes=["bart"] to every station', () => {
    const csv = 'stop_id,stop_name,stop_lat,stop_lon\nEMBR,Embarcadero,37.79,-122.39\n'
    expect(parseBartStops(csv)[0].modes).toEqual(['bart'])
  })
})

describe('BART_SF_BBOX', () => {
  it('covers SF + Daly City', () => {
    expect(BART_SF_BBOX.south).toBeLessThanOrEqual(37.706)
    expect(BART_SF_BBOX.north).toBeGreaterThanOrEqual(37.81)
  })
})
