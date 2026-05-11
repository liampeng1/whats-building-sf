import {
  simplifyAndBuildBartFeatures,
  classifyMuniShape,
  buildMuniFeatures,
  clipLineToBbox,
} from '../scripts/sources/transit-corridors'

describe('simplifyAndBuildBartFeatures', () => {
  it('returns one Feature per shape_id with mode=bart', () => {
    const shapes = new Map<string, [number, number][]>([
      ['SHP1', [[-122.40, 37.79], [-122.41, 37.80]]],
      ['SHP2', [[-122.45, 37.75], [-122.46, 37.76]]],
    ])
    const features = simplifyAndBuildBartFeatures(shapes)
    expect(features).toHaveLength(2)
    expect(features[0].properties.mode).toBe('bart')
    expect(features[0].geometry.type).toBe('LineString')
    expect(features[0].properties.line_name).toMatch(/BART/)
  })

  it('produces GeoJSON LineString coordinates as [lng, lat]', () => {
    const shapes = new Map<string, [number, number][]>([['A', [[-122.40, 37.79]]]])
    const features = simplifyAndBuildBartFeatures(shapes)
    expect(features[0].geometry.coordinates).toEqual([[-122.40, 37.79]])
  })
})

describe('classifyMuniShape', () => {
  it('returns muni-metro for K/L/M/N/T/J short names', () => {
    expect(classifyMuniShape('N')).toBe('muni-metro')
    expect(classifyMuniShape('T')).toBe('muni-metro')
    expect(classifyMuniShape('J')).toBe('muni-metro')
  })
  it('returns rapid-bus for R-suffix short names', () => {
    expect(classifyMuniShape('38R')).toBe('rapid-bus')
    expect(classifyMuniShape('5R')).toBe('rapid-bus')
  })
  it('returns null for regular bus / cable car routes', () => {
    expect(classifyMuniShape('38')).toBeNull()
    expect(classifyMuniShape('60')).toBeNull()
  })
})

describe('buildMuniFeatures', () => {
  it('emits one feature per shape with mode determined by classification', () => {
    const shapes = new Map<string, [number, number][]>([
      ['shN', [[-122.5, 37.76], [-122.46, 37.76]]],
      ['sh38R', [[-122.4, 37.78], [-122.4, 37.79]]],
      ['sh38', [[-122.4, 37.78], [-122.4, 37.79]]],
    ])
    const trips = [
      { trip_id: 't1', route_id: 'rN', shape_id: 'shN' },
      { trip_id: 't2', route_id: 'r38R', shape_id: 'sh38R' },
      { trip_id: 't3', route_id: 'r38', shape_id: 'sh38' },
    ]
    const routes = [
      { route_id: 'rN', route_short_name: 'N' },
      { route_id: 'r38R', route_short_name: '38R' },
      { route_id: 'r38', route_short_name: '38' },
    ]
    const out = buildMuniFeatures(shapes, trips, routes)
    expect(out).toHaveLength(2)   // sh38 is skipped (regular bus)
    expect(out.find((f) => f.properties.line_name === 'Muni · N')?.properties.mode).toBe('muni-metro')
    expect(out.find((f) => f.properties.line_name === 'Muni · 38R')?.properties.mode).toBe('rapid-bus')
  })
})

describe('clipLineToBbox', () => {
  const SF_BBOX = { west: -122.515, east: -122.355, south: 37.706, north: 37.81 }

  it('keeps contiguous in-bbox points as one segment', () => {
    const coords: [number, number][] = [
      [-122.40, 37.78],  // in
      [-122.39, 37.77],  // in
      [-122.20, 37.50],  // out (Burlingame)
      [-122.10, 37.45],  // out
    ]
    const out = clipLineToBbox(coords, SF_BBOX)
    expect(out).toEqual([[[-122.40, 37.78], [-122.39, 37.77]]])
  })

  it('returns empty when no points are in-bbox', () => {
    const coords: [number, number][] = [[-122.20, 37.50], [-122.10, 37.45]]
    const out = clipLineToBbox(coords, SF_BBOX)
    expect(out).toEqual([])
  })
})
