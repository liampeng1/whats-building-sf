'use client'
import { GeoJSON } from 'react-leaflet'
import { useEffect, useMemo, useState } from 'react'
import type { FeatureCollection, Polygon, MultiPolygon } from 'geojson'
import * as L from 'leaflet'

interface RingProperties {
  band: '0.25mi' | '0.5mi' | '1mi'
  miles: number
}

type RingsGeo = FeatureCollection<Polygon | MultiPolygon, RingProperties>

interface Props {
  selectedBand?: '0.25mi' | '0.5mi' | '1mi' | null
  onSelect?: (band: '0.25mi' | '0.5mi' | '1mi') => void
}

// Outer to inner band — render order matters so smaller rings sit on top.
// Coloured warmest at the densest (¼ mi) edge to read as a heatmap.
const BAND_STYLE: Record<string, { fill: string; stroke: string; fillOpacity: number }> = {
  '1mi':    { fill: '#fbf6ec', stroke: '#9a4a31', fillOpacity: 0.10 },
  '0.5mi':  { fill: '#b08968', stroke: '#9a4a31', fillOpacity: 0.18 },
  '0.25mi': { fill: '#9a4a31', stroke: '#7c2d12', fillOpacity: 0.28 },
}

const BAND_LABEL: Record<string, string> = {
  '0.25mi': 'within ¼ mi of rail',
  '0.5mi':  'within ½ mi of rail',
  '1mi':    'within 1 mi of rail',
}

function tooltipHtml(band: string): string {
  return `
    <div style="font-family:var(--font-source-serif),Georgia,serif;font-size:0.95rem;color:#1c2438;font-weight:600;line-height:1.1">
      Transit shed — ${band}
    </div>
    <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.08em;color:#78716c;margin-top:3px">
      ${BAND_LABEL[band] ?? ''}
    </div>
  `
}

/**
 * Renders the three pre-computed transit-distance bands as concentric
 * ring polygons. Geometry comes from `/transit-rings.geojson` (built
 * once by `scripts/build-cross-stats.ts`). Each ring is clickable and
 * focuses the panel on that band.
 */
export function TransitRings({ selectedBand = null, onSelect }: Props = {}) {
  const [geo, setGeo] = useState<RingsGeo | null>(null)
  useEffect(() => {
    const ctrl = new AbortController()
    fetch('/transit-rings.geojson', { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && data.type === 'FeatureCollection') setGeo(data as RingsGeo)
      })
      .catch(() => {})
    return () => ctrl.abort()
  }, [])

  // Render outer-to-inner so the inner (warmest) ring sits on top in z-order.
  const ordered = useMemo(() => {
    if (!geo) return null
    const order = ['1mi', '0.5mi', '0.25mi']
    return order
      .map((b) => geo.features.find((f) => f.properties?.band === b))
      .filter((f): f is RingsGeo['features'][number] => !!f)
  }, [geo])

  if (!ordered) return null

  return (
    <>
      {ordered.map((feature) => {
        const band = feature.properties.band
        const style = BAND_STYLE[band]
        const isSel = selectedBand === band
        return (
          <GeoJSON
            key={`transit-${band}-${selectedBand ?? 'none'}`}
            data={feature}
            pathOptions={{ className: `transit-ring transit-ring-${band}` }}
            style={{
              fillColor: style.fill,
              fillOpacity: isSel ? Math.min(0.55, style.fillOpacity + 0.2) : style.fillOpacity,
              color: style.stroke,
              weight: isSel ? 2.5 : 1.2,
              opacity: isSel ? 1 : 0.65,
              interactive: !!onSelect,
            }}
            eventHandlers={{
              click: () => {
                if (onSelect) onSelect(band)
              },
            }}
            onEachFeature={(_f, layer) => {
              layer.bindTooltip(tooltipHtml(band), {
                sticky: true,
                direction: 'top',
                className: 'nhood-tooltip',
                opacity: 1,
              })
            }}
          />
        )
      })}
    </>
  )
}

// Quiet the unused-import warning on builds — L is used in the JSX-less type
// imports above (LatLngBounds via Leaflet's PathOptions etc.)
void L
