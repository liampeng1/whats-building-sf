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
    expect(out[0].id).toBe('muni-castro-station')
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
