import { promises as fs } from 'node:fs'
import path from 'node:path'
import {
  parseGtfsFiles,
  selectRailRouteIds,
  selectRapidBusRouteIds,
  buildStopRouteMap,
  buildRailStations,
  buildRapidBusStops,
} from '../scripts/sources/muni-stops'

const FIX = path.join(__dirname, 'fixtures', 'muni-gtfs')

async function loadFixture() {
  const [stops, routes, trips, stop_times] = await Promise.all([
    fs.readFile(path.join(FIX, 'stops.txt'), 'utf8'),
    fs.readFile(path.join(FIX, 'routes.txt'), 'utf8'),
    fs.readFile(path.join(FIX, 'trips.txt'), 'utf8'),
    fs.readFile(path.join(FIX, 'stop_times.txt'), 'utf8'),
  ])
  return parseGtfsFiles({ stops, routes, trips, stop_times })
}

describe('selectRailRouteIds', () => {
  it('picks routes whose short_name is K/L/M/N/T/J', async () => {
    const { routes } = await loadFixture()
    expect(selectRailRouteIds(routes).sort()).toEqual(['R-K', 'R-T'])
  })
})

describe('selectRapidBusRouteIds', () => {
  it('picks routes whose short_name ends with R', async () => {
    const { routes } = await loadFixture()
    expect(selectRapidBusRouteIds(routes).sort()).toEqual(['R-38R', 'R-5R'])
  })
  it('excludes plain 38', async () => {
    const { routes } = await loadFixture()
    expect(selectRapidBusRouteIds(routes)).not.toContain('R-38')
  })
})

describe('buildStopRouteMap', () => {
  it('joins stop_times → trips → routes', async () => {
    const { trips, stop_times } = await loadFixture()
    const map = buildStopRouteMap(stop_times, trips)
    expect([...(map.get('S-CASTRO') ?? [])].sort()).toEqual(['R-K', 'R-T'])
    expect([...(map.get('S-MISSION-24TH') ?? [])].sort()).toEqual(['R-38', 'R-5R'])
  })
})

describe('buildRailStations', () => {
  it('returns stops served by at least one rail route', async () => {
    const { stops, routes, trips, stop_times } = await loadFixture()
    const map = buildStopRouteMap(stop_times, trips)
    const railIds = new Set(selectRailRouteIds(routes))
    const out = buildRailStations(stops, map, railIds)
    expect(out.map((s) => s.name)).toEqual(['Castro Station'])
    expect(out[0].modes).toEqual(['muni-metro'])
    expect(out[0].id).toBe('muni-S-CASTRO-castro-station')
  })

  it('filters out entrance/exit rows (location_type=2)', async () => {
    const { stops, trips, stop_times } = await loadFixture()
    const map = buildStopRouteMap(stop_times, trips)
    const railIds = new Set(['R-K'])
    const out = buildRailStations(stops, map, railIds)
    expect(out.find((s) => s.name === 'Castro Station Entrance')).toBeUndefined()
  })

  it('rejects stops with location_type != 0', async () => {
    const { stops, routes, trips, stop_times } = await loadFixture()
    const stopMap = buildStopRouteMap(stop_times, trips)
    const railIds = new Set(selectRailRouteIds(routes))
    const out = buildRailStations(stops, stopMap, railIds)
    expect(out.find((s) => s.name.includes('Entrance'))).toBeUndefined()
  })

  it('accepts empty location_type (GTFS spec default = type 0)', async () => {
    const { stops } = await loadFixture()
    const stopsWithEmpty = [
      ...stops,
      { stop_id: 'S-TEST-EMPTY', stop_name: 'Test Empty', stop_lat: '37.762', stop_lon: '-122.43', location_type: '' } as typeof stops[number],
    ]
    const stopMap = new Map<string, Set<string>>([
      ['S-TEST-EMPTY', new Set(['R-K'])],
    ])
    const railIds = new Set(['R-K'])
    const out = buildRailStations(stopsWithEmpty, stopMap, railIds)
    expect(out.find((s) => s.name === 'Test Empty')).toBeDefined()
  })
})

describe('buildRapidBusStops', () => {
  it('returns stops served by a rapid route, listing only their R-suffix routes', async () => {
    const { stops, routes, trips, stop_times } = await loadFixture()
    const map = buildStopRouteMap(stop_times, trips)
    const rapidIds = new Set(selectRapidBusRouteIds(routes))
    const out = buildRapidBusStops(stops, routes, map, rapidIds)
    const names = out.map((s) => s.name).sort()
    expect(names).toEqual(['Geary & Powell', 'Mission & 24th'])
    const mission = out.find((s) => s.name === 'Mission & 24th')!
    expect(mission.routes).toEqual(['5R'])  // 38 (non-rapid) excluded
  })
})

describe('slug collision handling', () => {
  it('buildRailStations produces unique ids even when stop names collide', async () => {
    // Two stops with the same name (e.g. opposite sides of an intersection)
    // must produce distinct ids so React keys don't collide.
    const { stops } = await loadFixture()
    const colliding = [
      ...stops,
      { stop_id: 'S-CASTRO-DUP', stop_name: 'Castro Station', stop_lat: '37.762', stop_lon: '-122.430', location_type: '0' } as typeof stops[number],
    ]
    // Use a stopMap that references both Castro stops for the same rail route
    const stopMap = new Map<string, Set<string>>([
      ['S-CASTRO', new Set(['R-K'])],
      ['S-CASTRO-DUP', new Set(['R-K'])],
    ])
    const railIds = new Set(['R-K'])
    const out = buildRailStations(colliding, stopMap, railIds)
    const ids = new Set(out.map((s) => s.id))
    expect(ids.size).toBe(out.length)  // all ids must be unique
    expect(out.length).toBe(2)  // both stops should be in the output
  })

  it('buildRapidBusStops produces unique ids even when stop names collide', async () => {
    // Two stops with the same name must produce distinct ids.
    const { stops, routes } = await loadFixture()
    const colliding = [
      ...stops,
      { stop_id: 'S-MISSION-24TH-DUP', stop_name: 'Mission & 24th', stop_lat: '37.750', stop_lon: '-122.420', location_type: '0' } as typeof stops[number],
    ]
    // Use a stopMap that references both Mission 24th stops for rapid routes
    const stopMap = new Map<string, Set<string>>([
      ['S-MISSION-24TH', new Set(['R-5R', 'R-38'])],
      ['S-MISSION-24TH-DUP', new Set(['R-5R'])],
    ])
    const rapidIds = new Set(['R-5R', 'R-38R'])
    const out = buildRapidBusStops(colliding, routes, stopMap, rapidIds)
    const ids = new Set(out.map((s) => s.id))
    expect(ids.size).toBe(out.length)  // all ids must be unique
    expect(out.length).toBe(2)  // both stops should be in the output
  })
})
