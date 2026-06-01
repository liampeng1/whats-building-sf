// components/StationMarkers.tsx
'use client'
import { Marker } from 'react-leaflet'
import L from 'leaflet'
import {
  RAIL_STATIONS, FREQ_STOPS, stopFreqBand,
  type RailStation, type FreqStop,
} from '@/lib/transit-stations'
import { TIER_COLORS } from '@/lib/transit-tiers-style'

// BART — 16px navy filled circle with cream "B" centered
const BART_ICON = L.divIcon({
  className: 'station-icon station-bart',
  html: '<span class="dot">B</span>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

// Muni Metro — 14px sage filled circle with cream "M" centered
const MUNI_ICON = L.divIcon({
  className: 'station-icon station-muni',
  html: '<span class="dot">M</span>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

// Caltrain — 14px gold square with small white "▤" (rail) glyph
const CALTRAIN_ICON = L.divIcon({
  className: 'station-icon station-caltrain',
  html: '<span class="square">▤</span>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

// Bus stop — 8px open dot whose border color encodes the frequency band.
// One cached icon per band color (reuses the .bus-dot visual + hover).
const freqIconCache = new Map<string, L.DivIcon>()
function freqIcon(color: string): L.DivIcon {
  let icon = freqIconCache.get(color)
  if (!icon) {
    icon = L.divIcon({
      className: 'station-icon station-bus',
      html: `<span class="bus-dot" style="border-color:${color}"></span>`,
      iconSize: [8, 8],
      iconAnchor: [4, 4],
    })
    freqIconCache.set(color, icon)
  }
  return icon
}

function railIconForStation(s: RailStation): L.DivIcon {
  // Merged stations may serve multiple modes; pick the most prominent for display.
  if (s.modes.includes('bart')) return BART_ICON
  if (s.modes.includes('caltrain')) return CALTRAIN_ICON
  return MUNI_ICON
}

export interface SelectedStation {
  kind: 'rail' | 'rapid-bus' | 'freq-stop'
  id: string
}

interface Props {
  show: boolean
  zoom: number
  onSelect: (s: SelectedStation) => void
}

export function StationMarkers({ show, zoom, onSelect }: Props) {
  if (!show) return null
  const showBus = zoom >= 14
  return (
    <>
      {RAIL_STATIONS.map((s: RailStation) => (
        <Marker
          key={s.id}
          position={[s.lat, s.lng]}
          icon={railIconForStation(s)}
          eventHandlers={{ click: () => onSelect({ kind: 'rail', id: s.id }) }}
          title={`${s.name} · ${s.modes.join(' / ')}`}
        />
      ))}
      {showBus && FREQ_STOPS.map((s: FreqStop) => {
        const band = stopFreqBand(s)
        if (band === 'poor') return null // < 2 bus trips/hr — not a meaningful stop dot
        return (
          <Marker
            key={s.id}
            position={[s.lat, s.lng]}
            icon={freqIcon(TIER_COLORS[band])}
            eventHandlers={{ click: () => onSelect({ kind: 'freq-stop', id: s.id }) }}
            title={`${s.name} · ${s.routes.map((r) => r.route).join(', ')}`}
          />
        )
      })}
    </>
  )
}
