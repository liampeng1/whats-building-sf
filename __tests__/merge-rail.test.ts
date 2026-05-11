import { mergeRailStations } from '../scripts/sources/merge-rail'

describe('mergeRailStations', () => {
  it('dedupes stations within 50m and merges modes', () => {
    const out = mergeRailStations([
      { id: 'bart-embarcadero',  name: 'Embarcadero', lat: 37.7929, lng: -122.3969, modes: ['bart'] },
      { id: 'muni-embarcadero',  name: 'Embarcadero', lat: 37.7930, lng: -122.3970, modes: ['muni-metro'] },
      { id: 'muni-castro-station', name: 'Castro Station', lat: 37.762, lng: -122.43492, modes: ['muni-metro'] },
    ])
    expect(out).toHaveLength(2)
    const emb = out.find((s) => s.name === 'Embarcadero')!
    expect(emb.modes.sort()).toEqual(['bart', 'muni-metro'])
  })

  it('keeps stations >50m apart distinct', () => {
    const out = mergeRailStations([
      { id: 'a', name: 'A', lat: 37.7000, lng: -122.4000, modes: ['bart'] },
      { id: 'b', name: 'B', lat: 37.7100, lng: -122.4000, modes: ['bart'] },  // ~1.1 km away
    ])
    expect(out).toHaveLength(2)
  })

  it('dedupes idempotently (same modes not duplicated)', () => {
    const out = mergeRailStations([
      { id: 'a1', name: 'A', lat: 37.7, lng: -122.4, modes: ['bart'] },
      { id: 'a2', name: 'A copy', lat: 37.70001, lng: -122.4, modes: ['bart'] },
    ])
    expect(out).toHaveLength(1)
    expect(out[0].modes).toEqual(['bart'])
  })
})
