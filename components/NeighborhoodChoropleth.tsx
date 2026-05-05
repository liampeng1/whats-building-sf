'use client'
import { GeoJSON, useMap, useMapEvents } from 'react-leaflet'
import { useEffect, useMemo, useState } from 'react'
import type { FeatureCollection, Feature, MultiPolygon, Polygon } from 'geojson'
import type { Permit } from '@/lib/types'
import { pointInGeometry } from '@/lib/point-in-polygon'

interface Props {
  permits: Permit[]
  /** Hide the choropleth above this zoom — at street level individual pins
   * are more useful and the polygon fills become visual noise. */
  hideAtZoom?: number
}

type NhoodFeature = Feature<MultiPolygon | Polygon, { nhood: string }>

// Sequential ramp from paper-cream (low) to deep amber/red (high). Anchors
// against the editorial palette already in use.
const RAMP = [
  '#fbf6ec', // paper — 0 permits
  '#f3e9c6', // pale gold — 1-25%
  '#e8c585', // sand — 25-50%
  '#d97706', // amber — 50-75%
  '#b45309', // burnt — 75-90%
  '#7c2d12', // deep — top 10%
]

function colorForFraction(fraction: number): string {
  if (fraction <= 0) return RAMP[0]
  if (fraction < 0.25) return RAMP[1]
  if (fraction < 0.5) return RAMP[2]
  if (fraction < 0.75) return RAMP[3]
  if (fraction < 0.9) return RAMP[4]
  return RAMP[5]
}

export function NeighborhoodChoropleth({ permits, hideAtZoom = 15 }: Props) {
  const map = useMap()
  const [geo, setGeo] = useState<FeatureCollection<MultiPolygon | Polygon, { nhood: string }> | null>(null)
  const [zoom, setZoom] = useState<number>(map.getZoom())

  useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
  })

  useEffect(() => {
    fetch('/sf-neighborhoods.geojson')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
      .then(setGeo)
      .catch(() => setGeo(null))
  }, [])

  const { counts, max } = useMemo(() => {
    const map = new Map<string, number>()
    if (!geo) return { counts: map, max: 0 }
    const features = geo.features as NhoodFeature[]
    for (const p of permits) {
      if (!p.location) continue
      const [lng, lat] = p.location.coordinates
      // Point-in-polygon check for each feature; first match wins.
      for (const f of features) {
        if (pointInGeometry(lng, lat, f.geometry)) {
          const name = f.properties?.nhood ?? ''
          map.set(name, (map.get(name) ?? 0) + 1)
          break
        }
      }
    }
    return { counts: map, max: Math.max(0, ...map.values()) }
  }, [geo, permits])

  if (!geo || zoom >= hideAtZoom) return null

  return (
    <GeoJSON
      key={`choropleth-${permits.length}-${max}`}
      data={geo}
      style={(feature) => {
        const name = (feature?.properties as { nhood?: string } | undefined)?.nhood ?? ''
        const count = counts.get(name) ?? 0
        const fraction = max > 0 ? count / max : 0
        return {
          fillColor: colorForFraction(fraction),
          fillOpacity: count === 0 ? 0.05 : 0.45,
          color: '#1c2438', // navy ink stroke matches the editorial chrome
          weight: 0.6,
          opacity: 0.4,
        }
      }}
      onEachFeature={(feature, layer) => {
        const name = (feature.properties as { nhood?: string } | undefined)?.nhood ?? '—'
        const count = counts.get(name) ?? 0
        layer.bindTooltip(
          `<div style="font-family:var(--font-source-serif),Georgia,serif;font-size:0.95rem;color:#1c2438"><strong>${name}</strong></div><div style="font-size:0.75rem;color:#475569">${count} active permit${count === 1 ? '' : 's'}</div>`,
          { sticky: true, direction: 'top', className: 'nhood-tooltip' },
        )
      }}
    />
  )
}
