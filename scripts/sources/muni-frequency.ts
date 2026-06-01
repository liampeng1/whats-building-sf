/**
 * Per-stop Muni service frequency, derived from the SFMTA GTFS feed
 * (511.org regional feed, operator SF). For every boardable stop we emit
 * each route serving it with weekday peak and off-peak trips-per-hour.
 *
 * Unlike the name-based rapid/local pipelines in muni-stops.ts, this is a
 * real measured signal: we resolve a representative weekday from the feed's
 * calendar, then count departures in fixed time windows.
 *
 * The pure functions below carry the logic and are unit-tested. fetch /
 * orchestration glue lives in muni-stops.ts (fetchMuniGtfs) and
 * build-cross-stats.ts.
 */

import { slugify } from './_utils'
import type { FreqStop, RouteFreq, RouteMode } from '../../lib/transit-stations'

export interface CalendarRow {
  service_id: string
  monday: string
  tuesday: string
  wednesday: string
  thursday: string
  friday: string
  saturday: string
  sunday: string
  start_date: string
  end_date: string
}

export interface CalendarDateRow {
  service_id: string
  date: string
  exception_type: string
}

export interface GtfsTripRow {
  trip_id: string
  route_id: string
  service_id: string
}

export interface GtfsStopTimeRow {
  trip_id: string
  stop_id: string
  departure_time: string
}

export interface GtfsRouteRow {
  route_id: string
  route_short_name: string
  route_type: string
}

export interface GtfsStopRow {
  stop_id: string
  stop_name: string
  stop_lat: string
  stop_lon: string
  location_type?: string
}

export interface TimeWindow {
  startSec: number
  endSec: number
}

/** Weekday AM peak: 07:00–09:00. */
export const PEAK_WINDOW: TimeWindow = { startSec: 7 * 3600, endSec: 9 * 3600 }
/** Weekday daytime base (off-peak): 10:00–15:00. */
export const OFF_PEAK_WINDOW: TimeWindow = { startSec: 10 * 3600, endSec: 15 * 3600 }

const WEEKDAYS = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
] as const
type WeekdayKey = (typeof WEEKDAYS)[number]

/** GTFS time → seconds since midnight. Owl times like "25:14:00" are kept as
 *  > 86400 (NOT wrapped) so they fall outside daytime windows. NaN if blank
 *  or malformed. */
export function parseGtfsTime(s: string): number {
  const m = /^(\d{1,2}):(\d{2}):(\d{2})$/.exec(s.trim())
  if (!m) return NaN
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
}

function parseYmd(d: string): Date {
  const y = Number(d.slice(0, 4))
  const mo = Number(d.slice(4, 6))
  const day = Number(d.slice(6, 8))
  return new Date(Date.UTC(y, mo - 1, day))
}

function fmtYmd(dt: Date): string {
  const y = dt.getUTCFullYear().toString().padStart(4, '0')
  const mo = (dt.getUTCMonth() + 1).toString().padStart(2, '0')
  const day = dt.getUTCDate().toString().padStart(2, '0')
  return `${y}${mo}${day}`
}

/** Lowercase GTFS weekday column for a YYYYMMDD date (e.g. 'wednesday'). */
export function weekdayKey(date: string): WeekdayKey {
  return WEEKDAYS[parseYmd(date).getUTCDay()]
}

/** Service ids in effect on `date` (YYYYMMDD): calendar.txt day-of-week +
 *  active window, with calendar_dates.txt additions (1) / removals (2). */
export function resolveServiceIds(
  calendar: CalendarRow[],
  calendarDates: CalendarDateRow[],
  date: string,
): Set<string> {
  const key = weekdayKey(date)
  const active = new Set<string>()
  for (const row of calendar) {
    if (row[key] === '1' && row.start_date <= date && date <= row.end_date) {
      active.add(row.service_id)
    }
  }
  for (const ex of calendarDates) {
    if (ex.date !== date) continue
    if (ex.exception_type === '1') active.add(ex.service_id)
    else if (ex.exception_type === '2') active.delete(ex.service_id)
  }
  return active
}

/** Pick a representative weekday (Wednesday) covered by the most services in
 *  the feed. Deterministic: ties resolve to the earliest such Wednesday. */
export function pickServiceDate(
  calendar: CalendarRow[],
  calendarDates: CalendarDateRow[],
): string {
  if (calendar.length === 0) return ''
  let minStart = calendar[0].start_date
  let maxEnd = calendar[0].end_date
  for (const r of calendar) {
    if (r.start_date < minStart) minStart = r.start_date
    if (r.end_date > maxEnd) maxEnd = r.end_date
  }
  // Advance to the first Wednesday on/after minStart (getUTCDay() === 3).
  const cursor = parseYmd(minStart)
  while (cursor.getUTCDay() !== 3) cursor.setUTCDate(cursor.getUTCDate() + 1)
  const end = parseYmd(maxEnd)
  let best = ''
  let bestCount = -1
  for (; cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 7)) {
    const d = fmtYmd(cursor)
    const count = resolveServiceIds(calendar, calendarDates, d).size
    if (count > bestCount) {
      bestCount = count
      best = d
    }
  }
  return best
}

/** trip_id → {route_id, service_id}. */
export function buildTripIndex(
  trips: GtfsTripRow[],
): Map<string, { route_id: string; service_id: string }> {
  const idx = new Map<string, { route_id: string; service_id: string }>()
  for (const t of trips) idx.set(t.trip_id, { route_id: t.route_id, service_id: t.service_id })
  return idx
}

/** Count departures per stop per route within a time window, restricted to
 *  the given active service ids. Returns stop_id → route_id → count. */
export function countTripsInWindow(
  stopTimes: GtfsStopTimeRow[],
  tripIndex: Map<string, { route_id: string; service_id: string }>,
  activeServiceIds: Set<string>,
  window: TimeWindow,
): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>()
  for (const st of stopTimes) {
    const trip = tripIndex.get(st.trip_id)
    if (!trip || !activeServiceIds.has(trip.service_id)) continue
    const t = parseGtfsTime(st.departure_time)
    if (!Number.isFinite(t) || t < window.startSec || t >= window.endSec) continue
    let byRoute = out.get(st.stop_id)
    if (!byRoute) { byRoute = new Map(); out.set(st.stop_id, byRoute) }
    byRoute.set(trip.route_id, (byRoute.get(trip.route_id) ?? 0) + 1)
  }
  return out
}

function modeFromRouteType(routeType: string): RouteMode {
  switch (routeType) {
    case '3': return 'bus'
    case '5': return 'cable-car'
    case '0':
    case '1':
    case '2': return 'muni-metro'
    default: return 'bus'
  }
}

function isBoardableStop(s: GtfsStopRow): boolean {
  if (!s.stop_name?.trim()) return false
  if (s.location_type !== '' && s.location_type !== undefined && s.location_type !== '0') return false
  return Number.isFinite(Number(s.stop_lat)) && Number.isFinite(Number(s.stop_lon))
}

function tph(count: number, hours: number): number {
  return Math.round((count / hours) * 100) / 100
}

interface PeriodCounts {
  counts: Map<string, Map<string, number>>
  hours: number
}

/** Assemble the per-stop frequency dataset. A stop appears if at least one
 *  route serves it in either window; each route carries peak + off-peak tph
 *  (0 when it does not run in that window). */
export function buildStopFrequency(
  stops: GtfsStopRow[],
  routes: GtfsRouteRow[],
  peak: PeriodCounts,
  offPeak: PeriodCounts,
): FreqStop[] {
  const routeMeta = new Map(
    routes.map((r) => [r.route_id, { short: r.route_short_name, mode: modeFromRouteType(r.route_type) }]),
  )
  const stopById = new Map<string, GtfsStopRow>()
  for (const s of stops) if (isBoardableStop(s)) stopById.set(s.stop_id, s)

  const stopIds = new Set<string>([...peak.counts.keys(), ...offPeak.counts.keys()])
  const out: FreqStop[] = []
  for (const stopId of stopIds) {
    const stop = stopById.get(stopId)
    if (!stop) continue
    const peakByRoute = peak.counts.get(stopId) ?? new Map<string, number>()
    const offByRoute = offPeak.counts.get(stopId) ?? new Map<string, number>()
    const routeIds = new Set<string>([...peakByRoute.keys(), ...offByRoute.keys()])
    const routeFreqs: RouteFreq[] = []
    for (const routeId of routeIds) {
      const meta = routeMeta.get(routeId)
      if (!meta) continue
      routeFreqs.push({
        route: meta.short,
        mode: meta.mode,
        peakTph: tph(peakByRoute.get(routeId) ?? 0, peak.hours),
        offPeakTph: tph(offByRoute.get(routeId) ?? 0, offPeak.hours),
      })
    }
    if (routeFreqs.length === 0) continue
    routeFreqs.sort((a, b) => a.route.localeCompare(b.route))
    out.push({
      id: `muni-${stop.stop_id}-${slugify(stop.stop_name)}`,
      name: stop.stop_name,
      lat: Number(stop.stop_lat),
      lng: Number(stop.stop_lon),
      routes: routeFreqs,
    })
  }
  out.sort((a, b) => a.id.localeCompare(b.id))
  return out
}

function windowHours(w: TimeWindow): number {
  return (w.endSec - w.startSec) / 3600
}

/** End-to-end: resolve a representative weekday from the feed calendar, then
 *  count peak and off-peak departures into the per-stop frequency dataset.
 *  `gtfs` is the parsed SFMTA feed (see muni-stops.fetchMuniGtfs). */
export function buildMuniFrequency(
  gtfs: {
    stops: GtfsStopRow[]
    routes: GtfsRouteRow[]
    trips: GtfsTripRow[]
    stop_times: GtfsStopTimeRow[]
  },
  calendar: CalendarRow[],
  calendarDates: CalendarDateRow[],
): FreqStop[] {
  const date = pickServiceDate(calendar, calendarDates)
  const active = resolveServiceIds(calendar, calendarDates, date)
  const tripIndex = buildTripIndex(gtfs.trips)
  const peakCounts = countTripsInWindow(gtfs.stop_times, tripIndex, active, PEAK_WINDOW)
  const offCounts = countTripsInWindow(gtfs.stop_times, tripIndex, active, OFF_PEAK_WINDOW)
  return buildStopFrequency(
    gtfs.stops,
    gtfs.routes,
    { counts: peakCounts, hours: windowHours(PEAK_WINDOW) },
    { counts: offCounts, hours: windowHours(OFF_PEAK_WINDOW) },
  )
}
