/**
 * Presentation helpers for per-stop frequency. Pure + unit-tested so the
 * StopFrequencyPanel stays a thin renderer. Headway in minutes is 60 / tph.
 */
import type { RouteFreq } from './transit-stations'

/** Trips/hour → a rounded "N min" headway label, or "—" for no service. */
export function headwayLabel(tph: number): string {
  if (!Number.isFinite(tph) || tph <= 0) return '—'
  return `${Math.round(60 / tph)} min`
}

/** One-line peak/midday summary for a route serving a stop. */
export function routeFreqSummary(r: RouteFreq): string {
  const peak = r.peakTph > 0
  const off = r.offPeakTph > 0
  if (peak && off) return `${headwayLabel(r.peakTph)} peak / ${headwayLabel(r.offPeakTph)} midday`
  if (peak) return `${headwayLabel(r.peakTph)} peak · peak only`
  if (off) return `${headwayLabel(r.offPeakTph)} midday`
  return 'no service'
}
