import routes from './fixtures/muni-routes-sample.json'
import stops from './fixtures/muni-stops-sample.json'
import {
  selectRailRouteIds,
  selectRapidBusRouteIds,
  buildRailStations,
  buildRapidBusStops,
} from '../scripts/sources/muni-stops'

describe('selectRailRouteIds', () => {
  it('picks K/L/M/N/T/J lineabbrs', () => {
    expect(selectRailRouteIds(routes).sort()).toEqual(['1001', '1002'])
  })
})

describe('selectRapidBusRouteIds', () => {
  it('picks R-suffix lineabbrs only', () => {
    expect(selectRapidBusRouteIds(routes).sort()).toEqual(['2001', '2002'])
  })
  it('excludes plain 38 (no R suffix)', () => {
    expect(selectRapidBusRouteIds(routes)).not.toContain('9001')
  })
})

describe('buildRailStations', () => {
  it('returns stops served by at least one rail route', () => {
    const railIds = new Set(selectRailRouteIds(routes))
    const out = buildRailStations(stops, railIds)
    expect(out.map((s) => s.name)).toEqual(['Castro Station'])
    expect(out[0].modes).toEqual(['muni-metro'])
    expect(out[0].id).toBe('muni-castro-station')
  })
})

describe('buildRapidBusStops', () => {
  it('returns stops served by at least one R-suffix route, with lineabbr list', () => {
    const ids = new Set(selectRapidBusRouteIds(routes))
    const out = buildRapidBusStops(stops, routes, ids)
    const names = out.map((s) => s.name).sort()
    expect(names).toEqual(['Geary & Powell', 'Mission & 24th'])
    const mission = out.find((s) => s.name === 'Mission & 24th')!
    expect(mission.routes).toEqual(['5R'])  // 38 (non-rapid) filtered out
  })
})
