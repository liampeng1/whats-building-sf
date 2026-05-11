import { parseCaltrainStops, CALTRAIN_SF_STOP_IDS } from '../scripts/sources/caltrain-stations'

describe('parseCaltrainStops', () => {
  it('filters to the SF stop_id whitelist', () => {
    const csv = `stop_id,stop_name,stop_lat,stop_lon
70011,San Francisco Caltrain,37.7766,-122.3942
70021,22nd Street Caltrain,37.7575,-122.3924
70031,Bayshore Caltrain,37.7099,-122.4019
70041,South San Francisco,37.6562,-122.4054
70051,San Bruno,37.6313,-122.4123
`
    const out = parseCaltrainStops(csv)
    expect(out.map((s) => s.id).sort()).toEqual([
      'caltrain-22nd-street-caltrain',
      'caltrain-bayshore-caltrain',
      'caltrain-san-francisco-caltrain',
    ])
    expect(out[0].modes).toEqual(['caltrain'])
  })
})

describe('CALTRAIN_SF_STOP_IDS', () => {
  it('contains exactly the three SF stop_ids', () => {
    expect([...CALTRAIN_SF_STOP_IDS].sort()).toEqual(['70011', '70021', '70031'])
  })
})
