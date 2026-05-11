// components/StationMarkers.tsx
'use client'
import { Marker } from 'react-leaflet'
import L from 'leaflet'
import {
  RAIL_STATIONS, RAPID_BUS_STOPS,
  type RailStation, type RapidBusStop,
} from '@/lib/transit-stations'

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

// Rapid bus — 8px open sienna dot, no glyph
const BUS_ICON = L.divIcon({
  className: 'station-icon station-bus',
  html: '<span class="bus-dot"></span>',
  iconSize: [8, 8],
  iconAnchor: [4, 4],
})

function railIconForStation(s: RailStation): L.DivIcon {
  // Merged stations may serve multiple modes; pick the most prominent for display.
  if (s.modes.includes('bart')) return BART_ICON
  if (s.modes.includes('caltrain')) return CALTRAIN_ICON
  return MUNI_ICON
}

export interface SelectedStation {
  kind: 'rail' | 'rapid-bus'
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
      {showBus && RAPID_BUS_STOPS.map((s: RapidBusStop) => (
        <Marker
          key={s.id}
          position={[s.lat, s.lng]}
          icon={BUS_ICON}
          eventHandlers={{ click: () => onSelect({ kind: 'rapid-bus', id: s.id }) }}
          title={`${s.name} · ${s.routes.join(', ')}`}
        />
      ))}
    </>
  )
}
