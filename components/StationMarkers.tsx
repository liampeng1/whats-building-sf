'use client'
import { Marker } from 'react-leaflet'
import L from 'leaflet'
import { RAIL_STATIONS, RAPID_BUS_STOPS, type RailStation, type RapidBusStop } from '@/lib/transit-stations'

const RAIL_ICON = L.divIcon({
  className: 'station-icon station-rail',
  html: '<span class="dot"></span>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

const BUS_ICON = L.divIcon({
  className: 'station-icon station-bus',
  html: '<span class="square"></span>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
})

export interface SelectedStation {
  kind: 'rail' | 'rapid-bus'
  id: string
}

interface Props {
  show: boolean
  onSelect: (s: SelectedStation) => void
}

/** Clickable station/stop markers rendered when the transit lens is active.
 *  RAIL_STATIONS and RAPID_BUS_STOPS are hydrated by loadStations() at mount
 *  (see Map.tsx). Below the hydration races, the arrays are empty and no
 *  markers render — the component re-evaluates on the parent re-render. */
export function StationMarkers({ show, onSelect }: Props) {
  if (!show) return null
  return (
    <>
      {RAIL_STATIONS.map((s: RailStation) => (
        <Marker
          key={s.id}
          position={[s.lat, s.lng]}
          icon={RAIL_ICON}
          eventHandlers={{ click: () => onSelect({ kind: 'rail', id: s.id }) }}
          title={`${s.name} · ${s.modes.join(' / ')}`}
        />
      ))}
      {RAPID_BUS_STOPS.map((s: RapidBusStop) => (
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
