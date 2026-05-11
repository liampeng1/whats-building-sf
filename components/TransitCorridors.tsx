// components/TransitCorridors.tsx
'use client'
import { GeoJSON } from 'react-leaflet'
import { useEffect, useState } from 'react'
import type { FeatureCollection, LineString } from 'geojson'

type CorridorMode = 'bart' | 'muni-metro' | 'caltrain' | 'rapid-bus'

interface CorridorProperties {
  mode: CorridorMode
  line_name: string
}

type CorridorsGeo = FeatureCollection<LineString, CorridorProperties>

const MODE_STYLE: Record<CorridorMode, { color: string; weight: number; opacity: number }> = {
  bart:         { color: '#1c2438', weight: 2,   opacity: 0.85 },
  'muni-metro': { color: '#7d9b76', weight: 2,   opacity: 0.85 },
  caltrain:     { color: '#b08968', weight: 2,   opacity: 0.85 },
  'rapid-bus':  { color: '#9a4a31', weight: 1.5, opacity: 0.7  },
}

/** Renders the dotted transit corridor lines on the map when the transit
 *  lens is active. Loaded from /transit-corridors.geojson (built once per
 *  nightly cron). */
export function TransitCorridors() {
  const [geo, setGeo] = useState<CorridorsGeo | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    fetch('/transit-corridors.geojson', { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && data.type === 'FeatureCollection') setGeo(data as CorridorsGeo)
      })
      .catch(() => {})
    return () => ctrl.abort()
  }, [])

  if (!geo) return null

  return (
    <GeoJSON
      key="transit-corridors"
      data={geo}
      style={(feature) => {
        const mode = (feature?.properties as CorridorProperties | undefined)?.mode ?? 'rapid-bus'
        const style = MODE_STYLE[mode]
        return {
          color: style.color,
          weight: style.weight,
          opacity: style.opacity,
          dashArray: '2 4',
          fillOpacity: 0,
          interactive: false,
        }
      }}
    />
  )
}
