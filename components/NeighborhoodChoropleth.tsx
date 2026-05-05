'use client'
import { GeoJSON, useMap, useMapEvents } from 'react-leaflet'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { FeatureCollection, Feature, MultiPolygon, Polygon } from 'geojson'
import type * as L from 'leaflet'
import type { Permit } from '@/lib/types'
import { pointInGeometry } from '@/lib/point-in-polygon'
import {
  permitStage,
  stageIconSvg,
  STAGE_COLORS,
  STAGE_LABELS,
  STAGE_ORDER,
  type PermitStage,
} from '@/lib/permit-style'

interface Props {
  permits: Permit[]
  /** Above this zoom, the fill fades out — outlines remain visible. */
  hideAtZoom?: number
  onSelect?: (name: string, bounds: L.LatLngBounds) => void
}

type NhoodFeature = Feature<MultiPolygon | Polygon, { nhood: string }>
type NhoodGeo = FeatureCollection<MultiPolygon | Polygon, { nhood: string }>

// Sequential ramp from paper-cream (low) to deep amber (high). Matches the
// editorial palette already in use elsewhere in the app.
const RAMP = [
  '#fbf6ec', // paper — 0 permits
  '#f3e9c6', // pale gold
  '#e8c585', // sand
  '#d97706', // amber
  '#b45309', // burnt
  '#7c2d12', // deep
]

function colorForFraction(fraction: number): string {
  if (fraction <= 0) return RAMP[0]
  if (fraction < 0.25) return RAMP[1]
  if (fraction < 0.5) return RAMP[2]
  if (fraction < 0.75) return RAMP[3]
  if (fraction < 0.9) return RAMP[4]
  return RAMP[5]
}

const ORDERED_STAGES: PermitStage[] = STAGE_ORDER.filter(
  (s) => s !== 'inactive',
) as PermitStage[]

function tooltipHtml(name: string, total: number, breakdown: Map<PermitStage, number>): string {
  const rows = ORDERED_STAGES.map((stage) => {
    const count = breakdown.get(stage) ?? 0
    if (count === 0) return null
    const color = STAGE_COLORS[stage].fill
    return `<div style="display:flex;align-items:center;gap:6px;font-size:0.78rem;color:#1c2438;line-height:1.3;margin-top:2px">
      <span style="display:inline-flex;width:14px;height:14px;flex-shrink:0">${stageIconSvg(stage, 14)}</span>
      <span style="font-variant-numeric:tabular-nums;font-weight:600;color:${color};min-width:18px">${count}</span>
      <span style="color:#475569">${STAGE_LABELS[stage].split(' / ')[0].split(' · ')[0]}</span>
    </div>`
  })
    .filter(Boolean)
    .join('')

  const empty = total === 0
    ? '<div style="font-size:0.78rem;color:#78716c;font-style:italic">No tracked permits</div>'
    : ''

  return `
    <div style="font-family:var(--font-source-serif),Georgia,serif;font-size:0.95rem;color:#1c2438;font-weight:600;line-height:1.1">
      ${name}
    </div>
    <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.08em;color:#78716c;margin-top:3px;margin-bottom:5px">
      ${total} active permit${total === 1 ? '' : 's'}
    </div>
    ${empty}
    ${rows}
  `
}

export function NeighborhoodChoropleth({ permits, hideAtZoom = 14, onSelect }: Props) {
  const map = useMap()
  const [geo, setGeo] = useState<NhoodGeo | null>(null)
  const [zoom, setZoom] = useState<number>(map.getZoom())
  const layerRef = useRef<L.GeoJSON | null>(null)

  useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
  })

  useEffect(() => {
    fetch('/sf-neighborhoods.geojson')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
      .then(setGeo)
      .catch(() => setGeo(null))
  }, [])

  const { totals, breakdowns, max } = useMemo(() => {
    const totals = new Map<string, number>()
    const breakdowns = new Map<string, Map<PermitStage, number>>()
    if (!geo) return { totals, breakdowns, max: 0 }
    const features = geo.features as NhoodFeature[]
    for (const p of permits) {
      if (!p.location) continue
      const [lng, lat] = p.location.coordinates
      let nameMatch: string | null = null
      for (const f of features) {
        if (pointInGeometry(lng, lat, f.geometry)) {
          nameMatch = f.properties?.nhood ?? null
          break
        }
      }
      if (!nameMatch) continue
      totals.set(nameMatch, (totals.get(nameMatch) ?? 0) + 1)
      const inner = breakdowns.get(nameMatch) ?? new Map<PermitStage, number>()
      const stage = permitStage(p)
      inner.set(stage, (inner.get(stage) ?? 0) + 1)
      breakdowns.set(nameMatch, inner)
    }
    return { totals, breakdowns, max: Math.max(0, ...totals.values()) }
  }, [geo, permits])

  if (!geo) return null

  const isFilled = zoom < hideAtZoom

  const baseStyleFor = (count: number, fraction: number) => ({
    fillColor: colorForFraction(fraction),
    fillOpacity: isFilled ? (count === 0 ? 0.05 : 0.45) : 0,
    color: '#1c2438',
    weight: isFilled ? 0.6 : 0.5,
    opacity: isFilled ? 0.4 : 0.3,
  })

  return (
    <GeoJSON
      // Force a re-mount when fill mode flips so styles re-apply cleanly.
      key={`choropleth-${isFilled}-${permits.length}-${max}`}
      ref={(r) => {
        layerRef.current = r ?? null
      }}
      data={geo}
      style={(feature) => {
        const name = (feature?.properties as { nhood?: string } | undefined)?.nhood ?? ''
        const count = totals.get(name) ?? 0
        const fraction = max > 0 ? count / max : 0
        return baseStyleFor(count, fraction)
      }}
      onEachFeature={(feature, layer) => {
        const name = (feature.properties as { nhood?: string } | undefined)?.nhood ?? '—'
        const total = totals.get(name) ?? 0
        const breakdown = breakdowns.get(name) ?? new Map<PermitStage, number>()
        layer.bindTooltip(tooltipHtml(name, total, breakdown), {
          sticky: true,
          direction: 'top',
          className: 'nhood-tooltip',
          opacity: 1,
        })
        // Hover = brighter fill + thicker stroke. Reset via the parent
        // GeoJSON layer's resetStyle so we don't drift over time.
        layer.on({
          mouseover: (e) => {
            const target = e.target as L.Path
            target.setStyle({
              fillOpacity: 0.75,
              weight: 2.5,
              color: '#0c1424',
              opacity: 1,
            })
            target.bringToFront()
          },
          mouseout: (e) => {
            if (layerRef.current) {
              layerRef.current.resetStyle(e.target as L.Layer)
            }
          },
          click: (e) => {
            if (!onSelect) return
            // Cast through unknown — react-leaflet's GeoJSON layer at this
            // call site is a vector layer with getBounds(); the GeoJSON
            // type doesn't expose it directly.
            const target = e.target as unknown as { getBounds: () => L.LatLngBounds }
            onSelect(name, target.getBounds())
          },
        })
      }}
    />
  )
}
