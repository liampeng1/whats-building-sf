'use client'
import { GeoJSON } from 'react-leaflet'
import { useEffect, useState } from 'react'
import type { FeatureCollection, Polygon, MultiPolygon } from 'geojson'

/**
 * Toggleable zoning-districts layer. Fetches once on mount (cached for
 * a week on the edge), then renders as a thin coloured polygon layer
 * underneath the choropleth so neighborhood outlines + permit pins
 * still read on top.
 *
 * Color encodes the "gen" field — a coarse classification that lumps
 * RH-1 / RH-2 / RH-3 / RTO into "Residential", NCT-* and CRNC into
 * "Mixed Use", etc. Lets a casual viewer see at a glance how much of
 * SF is zoned single-family vs higher density.
 */

interface ZoningProperties {
  zoning_sim: string
  districtna: string
  gen: string
  codesectio: string
}

type ZoningGeo = FeatureCollection<Polygon | MultiPolygon, ZoningProperties>

// Coarse general-category palette. Picked to harmonize with the existing
// stage / category palettes — earthy + low-saturation so the zoning layer
// reads as background context, not a competing data layer.
const GEN_COLORS: Record<string, string> = {
  Residential: '#7d9b76',     // sage (matches the "approved" stage)
  'Mixed Use': '#b08968',      // dusty gold
  Commercial: '#5d7a99',       // muted blue
  Industrial: '#67615a',       // slate stone
  'Public': '#8a6c87',          // plum
  Other: '#a8a29e',            // taupe
}

function genColor(gen: string): string {
  return GEN_COLORS[gen] ?? GEN_COLORS.Other
}

function tooltipHtml(props: ZoningProperties): string {
  return `
    <div style="font-family:var(--font-source-serif),Georgia,serif;font-size:0.95rem;color:#1c2438;font-weight:600;line-height:1.1">
      ${props.zoning_sim}
    </div>
    <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.08em;color:#78716c;margin-top:3px">
      ${props.gen || '—'}
    </div>
    <div style="font-size:0.78rem;color:#475569;margin-top:4px;line-height:1.3">
      ${props.districtna || ''}
    </div>
  `
}

export function ZoningOverlay() {
  const [geo, setGeo] = useState<ZoningGeo | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    fetch('/api/zoning', { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && data.type === 'FeatureCollection') setGeo(data as ZoningGeo)
      })
      .catch(() => {})
    return () => ctrl.abort()
  }, [])

  if (!geo) return null

  return (
    <GeoJSON
      key="zoning-overlay"
      data={geo}
      pathOptions={{ className: 'zoning-poly' }}
      style={(feature) => {
        const gen = (feature?.properties as ZoningProperties | undefined)?.gen ?? 'Other'
        const fill = genColor(gen)
        return {
          fillColor: fill,
          fillOpacity: 0.18,
          color: fill,
          weight: 0.5,
          opacity: 0.6,
          interactive: true,
        }
      }}
      onEachFeature={(feature, layer) => {
        const props = feature.properties as ZoningProperties
        layer.bindTooltip(tooltipHtml(props), {
          sticky: true,
          direction: 'top',
          className: 'nhood-tooltip',
          opacity: 1,
        })
      }}
    />
  )
}

export const ZONING_LEGEND: { gen: string; color: string }[] = [
  { gen: 'Residential', color: GEN_COLORS.Residential },
  { gen: 'Mixed Use', color: GEN_COLORS['Mixed Use'] },
  { gen: 'Commercial', color: GEN_COLORS.Commercial },
  { gen: 'Industrial', color: GEN_COLORS.Industrial },
]
