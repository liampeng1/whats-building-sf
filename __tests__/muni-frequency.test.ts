import {
  parseGtfsTime,
  weekdayKey,
  resolveServiceIds,
  pickServiceDate,
  buildTripIndex,
  countTripsInWindow,
  buildStopFrequency,
  buildMuniFrequency,
  PEAK_WINDOW,
  OFF_PEAK_WINDOW,
  type CalendarRow,
  type CalendarDateRow,
} from '../scripts/sources/muni-frequency'

describe('parseGtfsTime', () => {
  it('parses HH:MM:SS into seconds since midnight', () => {
    expect(parseGtfsTime('07:00:00')).toBe(7 * 3600)
    expect(parseGtfsTime('07:30:15')).toBe(7 * 3600 + 30 * 60 + 15)
  })
  it('handles single-digit (unpadded) hours', () => {
    expect(parseGtfsTime('7:05:00')).toBe(7 * 3600 + 5 * 60)
  })
  it('does NOT wrap owl times past 24:00:00 (keeps them out of AM peak)', () => {
    // 25:14:00 is 1:14am the next service day, not 1:14am of this one.
    expect(parseGtfsTime('25:14:00')).toBe(25 * 3600 + 14 * 60)
  })
  it('returns NaN for empty or malformed input', () => {
    expect(Number.isNaN(parseGtfsTime(''))).toBe(true)
    expect(Number.isNaN(parseGtfsTime('garbage'))).toBe(true)
  })
})

describe('weekdayKey', () => {
  it('maps a YYYYMMDD date to its lowercase GTFS weekday column', () => {
    // 2026-05-27 is a Wednesday.
    expect(weekdayKey('20260527')).toBe('wednesday')
    // 2026-05-31 is a Sunday.
    expect(weekdayKey('20260531')).toBe('sunday')
  })
})

describe('resolveServiceIds', () => {
  const calendar: CalendarRow[] = [
    { service_id: 'WKDY', monday: '1', tuesday: '1', wednesday: '1', thursday: '1', friday: '1', saturday: '0', sunday: '0', start_date: '20260101', end_date: '20261231' },
    { service_id: 'SAT',  monday: '0', tuesday: '0', wednesday: '0', thursday: '0', friday: '0', saturday: '1', sunday: '0', start_date: '20260101', end_date: '20261231' },
    { service_id: 'OLD',  monday: '1', tuesday: '1', wednesday: '1', thursday: '1', friday: '1', saturday: '0', sunday: '0', start_date: '20250101', end_date: '20251231' },
  ]

  it('returns services running on the given weekday within their active window', () => {
    // Wednesday in 2026 → WKDY only (SAT wrong day, OLD out of window).
    expect(resolveServiceIds(calendar, [], '20260527')).toEqual(new Set(['WKDY']))
  })

  it('excludes services whose date range does not cover the date', () => {
    // A Wednesday in 2025 → OLD is in window, WKDY is too (window starts 2026)? no.
    expect(resolveServiceIds(calendar, [], '20250101')).toEqual(new Set(['OLD']))
  })

  it('applies calendar_dates removals (exception_type 2)', () => {
    const dates: CalendarDateRow[] = [{ service_id: 'WKDY', date: '20260527', exception_type: '2' }]
    expect(resolveServiceIds(calendar, dates, '20260527')).toEqual(new Set())
  })

  it('applies calendar_dates additions (exception_type 1)', () => {
    // SAT normally not running on a Wednesday, but added for this date.
    const dates: CalendarDateRow[] = [{ service_id: 'SAT', date: '20260527', exception_type: '1' }]
    expect(resolveServiceIds(calendar, dates, '20260527')).toEqual(new Set(['WKDY', 'SAT']))
  })
})

describe('pickServiceDate', () => {
  it('picks a Wednesday covered by the most active services', () => {
    const calendar: CalendarRow[] = [
      { service_id: 'WKDY', monday: '1', tuesday: '1', wednesday: '1', thursday: '1', friday: '1', saturday: '0', sunday: '0', start_date: '20260301', end_date: '20260531' },
    ]
    const date = pickServiceDate(calendar, [])
    expect(weekdayKey(date)).toBe('wednesday')
    // Must fall inside the active window.
    expect(date >= '20260301' && date <= '20260531').toBe(true)
    // And that Wednesday must actually resolve to the service.
    expect(resolveServiceIds(calendar, [], date).has('WKDY')).toBe(true)
  })
})

describe('buildTripIndex', () => {
  it('maps trip_id → {route_id, service_id}', () => {
    const idx = buildTripIndex([
      { trip_id: 'T1', route_id: 'R-12', service_id: 'WKDY' },
      { trip_id: 'T2', route_id: 'R-12', service_id: 'SAT' },
    ])
    expect(idx.get('T1')).toEqual({ route_id: 'R-12', service_id: 'WKDY' })
    expect(idx.get('T2')!.service_id).toBe('SAT')
  })
})

describe('countTripsInWindow', () => {
  const tripIndex = buildTripIndex([
    { trip_id: 'T-A', route_id: 'R-12', service_id: 'WKDY' },
    { trip_id: 'T-B', route_id: 'R-12', service_id: 'WKDY' },
    { trip_id: 'T-WKND', route_id: 'R-12', service_id: 'SAT' },
    { trip_id: 'T-OWL', route_id: 'R-12', service_id: 'WKDY' },
  ])
  const active = new Set(['WKDY'])

  it('counts departures per stop per route inside the window', () => {
    const stopTimes = [
      { trip_id: 'T-A', stop_id: 'S1', departure_time: '07:10:00' },
      { trip_id: 'T-B', stop_id: 'S1', departure_time: '08:40:00' },
    ]
    const counts = countTripsInWindow(stopTimes, tripIndex, active, PEAK_WINDOW)
    expect(counts.get('S1')!.get('R-12')).toBe(2)
  })

  it('excludes trips whose service is not active that day', () => {
    const stopTimes = [{ trip_id: 'T-WKND', stop_id: 'S1', departure_time: '07:10:00' }]
    const counts = countTripsInWindow(stopTimes, tripIndex, active, PEAK_WINDOW)
    expect(counts.get('S1')).toBeUndefined()
  })

  it('excludes departures outside the window and owl times past 24:00', () => {
    const stopTimes = [
      { trip_id: 'T-A', stop_id: 'S1', departure_time: '06:59:59' }, // just before peak
      { trip_id: 'T-B', stop_id: 'S1', departure_time: '09:00:00' }, // exactly at end (exclusive)
      { trip_id: 'T-OWL', stop_id: 'S1', departure_time: '25:14:00' }, // owl, must not count
    ]
    const counts = countTripsInWindow(stopTimes, tripIndex, active, PEAK_WINDOW)
    expect(counts.get('S1')).toBeUndefined()
  })
})

describe('buildStopFrequency', () => {
  const stops = [
    { stop_id: 'S1', stop_name: 'Mission & 24th', stop_lat: '37.752', stop_lon: '-122.418', location_type: '0' },
    { stop_id: 'S2', stop_name: 'Castro Station', stop_lat: '37.762', stop_lon: '-122.435', location_type: '0' },
    { stop_id: 'S-ENT', stop_name: 'Castro Entrance', stop_lat: '37.762', stop_lon: '-122.435', location_type: '2' },
  ]
  const routes = [
    { route_id: 'R-12', route_short_name: '12', route_type: '3' },
    { route_id: 'R-K', route_short_name: 'K', route_type: '0' },
    { route_id: 'R-CC', route_short_name: 'Powell-Mason', route_type: '5' },
  ]
  // S1 served by route 12: 8 trips peak (2h → 4 tph), 5 trips off-peak (5h → 1 tph)
  const peak = new Map([['S1', new Map([['R-12', 8]])], ['S2', new Map([['R-K', 6]])]])
  const off = new Map([['S1', new Map([['R-12', 5]])], ['S2', new Map([['R-K', 10]])]])

  it('emits one entry per served stop with peak/off-peak trips per hour per route', () => {
    const out = buildStopFrequency(stops, routes, { counts: peak, hours: 2 }, { counts: off, hours: 5 })
    const s1 = out.find((s) => s.name === 'Mission & 24th')!
    expect(s1.routes).toEqual([{ route: '12', mode: 'bus', peakTph: 4, offPeakTph: 1 }])
  })

  it('derives mode from GTFS route_type (0→muni-metro, 3→bus, 5→cable-car)', () => {
    const ccPeak = new Map([['S2', new Map([['R-CC', 4]])]])
    const out = buildStopFrequency(stops, routes, { counts: ccPeak, hours: 2 }, { counts: new Map(), hours: 5 })
    expect(out.find((s) => s.name === 'Castro Station')!.routes[0].mode).toBe('cable-car')
    const k = buildStopFrequency(stops, routes, { counts: peak, hours: 2 }, { counts: off, hours: 5 })
    expect(k.find((s) => s.name === 'Castro Station')!.routes[0].mode).toBe('muni-metro')
  })

  it('produces stable, unique ids in the muni-<stop_id>-<slug> shape', () => {
    const out = buildStopFrequency(stops, routes, { counts: peak, hours: 2 }, { counts: off, hours: 5 })
    expect(out.find((s) => s.name === 'Mission & 24th')!.id).toBe('freq-S1-mission-24th')
    expect(new Set(out.map((s) => s.id)).size).toBe(out.length)
  })

  it('omits station entrances and other non-boardable rows (location_type != 0)', () => {
    const entPeak = new Map([['S-ENT', new Map([['R-K', 4]])]])
    const out = buildStopFrequency(stops, routes, { counts: entPeak, hours: 2 }, { counts: new Map(), hours: 5 })
    expect(out.find((s) => s.name === 'Castro Entrance')).toBeUndefined()
  })

  it('includes routes that run in only one period (0 for the other)', () => {
    const peakOnly = new Map([['S1', new Map([['R-12', 8]])]])
    const out = buildStopFrequency(stops, routes, { counts: peakOnly, hours: 2 }, { counts: new Map(), hours: 5 })
    expect(out.find((s) => s.name === 'Mission & 24th')!.routes[0]).toEqual({ route: '12', mode: 'bus', peakTph: 4, offPeakTph: 0 })
  })
})

describe('buildMuniFrequency (end-to-end from parsed GTFS)', () => {
  const gtfs = {
    stops: [
      { stop_id: 'S1', stop_name: 'Mission & 24th', stop_lat: '37.752', stop_lon: '-122.418', location_type: '0' },
    ],
    routes: [{ route_id: 'R-12', route_short_name: '12', route_type: '3' }],
    trips: [
      { trip_id: 'T1', route_id: 'R-12', service_id: 'WKDY' },
      { trip_id: 'T2', route_id: 'R-12', service_id: 'WKDY' },
      { trip_id: 'T3', route_id: 'R-12', service_id: 'WKDY' },
      { trip_id: 'T-SAT', route_id: 'R-12', service_id: 'SAT' },
    ],
    stop_times: [
      { trip_id: 'T1', stop_id: 'S1', departure_time: '07:10:00' }, // peak
      { trip_id: 'T2', stop_id: 'S1', departure_time: '07:50:00' }, // peak
      { trip_id: 'T3', stop_id: 'S1', departure_time: '11:00:00' }, // off-peak
      { trip_id: 'T-SAT', stop_id: 'S1', departure_time: '07:30:00' }, // wrong service day
    ],
  }
  const calendar: CalendarRow[] = [
    { service_id: 'WKDY', monday: '1', tuesday: '1', wednesday: '1', thursday: '1', friday: '1', saturday: '0', sunday: '0', start_date: '20260301', end_date: '20260531' },
    { service_id: 'SAT',  monday: '0', tuesday: '0', wednesday: '0', thursday: '0', friday: '0', saturday: '1', sunday: '0', start_date: '20260301', end_date: '20260531' },
  ]

  it('resolves a weekday and computes peak/off-peak tph per route', () => {
    const out = buildMuniFrequency(gtfs, calendar, [])
    expect(out).toHaveLength(1)
    // 2 peak trips over a 2h window → 1 tph; 1 off-peak trip over 5h → 0.2 tph.
    // Saturday trip excluded because the resolved day is a Wednesday.
    expect(out[0].routes).toEqual([{ route: '12', mode: 'bus', peakTph: 1, offPeakTph: 0.2 }])
  })
})

describe('window constants', () => {
  it('peak is the 7–9am weekday window', () => {
    expect(PEAK_WINDOW).toEqual({ startSec: 7 * 3600, endSec: 9 * 3600 })
  })
  it('off-peak is the 10am–3pm weekday base window', () => {
    expect(OFF_PEAK_WINDOW).toEqual({ startSec: 10 * 3600, endSec: 15 * 3600 })
  })
})
