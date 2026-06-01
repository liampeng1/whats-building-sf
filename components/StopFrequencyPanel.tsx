'use client'
import { LensInfoPanel } from './LensInfoPanel'
import {
  FREQ_STOPS,
  stopFreqBand,
  combinedBusPeakTph,
  type RouteMode,
} from '@/lib/transit-stations'
import { TIER_LABELS } from '@/lib/transit-tiers-style'
import { headwayLabel } from '@/lib/stop-frequency'

const MODE_SUFFIX: Record<RouteMode, string> = {
  bus: '',
  'muni-metro': ' · Metro',
  'cable-car': ' · Cable',
}

interface Props {
  stopId: string | null
  onClose: () => void
}

/**
 * Detail panel for a clicked Muni stop: every route serving it with its
 * weekday peak and midday headway, ordered by peak frequency. Built on the
 * shared LensInfoPanel chrome (as TransitTierPanel is). Data comes from the
 * hydrated FREQ_STOPS array.
 */
export function StopFrequencyPanel({ stopId, onClose }: Props) {
  const stop = stopId ? FREQ_STOPS.find((s) => s.id === stopId) : undefined
  const band = stop ? stopFreqBand(stop) : 'poor'
  const combined = stop ? combinedBusPeakTph(stop) : 0

  const rows = stop
    ? [...stop.routes]
        .sort((a, b) => b.peakTph - a.peakTph || a.route.localeCompare(b.route))
        .map((r) => ({
          label: `${r.route}${MODE_SUFFIX[r.mode]}`,
          value: `${headwayLabel(r.peakTph)} / ${headwayLabel(r.offPeakTph)}`,
        }))
    : []

  return (
    <LensInfoPanel
      open={!!stop}
      eyebrow="Transit stop"
      title={stop?.name ?? '—'}
      hero={
        stop
          ? {
              eyebrow: 'Peak service',
              value: TIER_LABELS[band],
              detail: `${combined} combined bus trips/hr at peak`,
            }
          : undefined
      }
      primary={{ eyebrow: 'Routes · peak / midday headway', rows }}
      primaryEmpty="No scheduled service."
      onClose={onClose}
    />
  )
}
