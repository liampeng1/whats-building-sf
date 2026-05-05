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
  /** When set, that polygon gets the persistent selected treatment and
   *  every other polygon dims so the eye is anchored on the active region. */
  selectedNhood?: string | null
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

export function NeighborhoodChoropleth({
  permits,
  hideAtZoom = 14,
  onSelect,
  selectedNhood = null,
}: Props) {
  const map = useMap()
  const [geo, setGeo] = useState<NhoodGeo | null>(null)
  // Track only whether we're below or above the fill-fade threshold — a
  // boolean changes far less often than the raw zoom level, so the layer
  // re-styles once per crossing instead of on every settled zoom.
  const [isFilled, setIsFilled] = useState<boolean>(map.getZoom() < hideAtZoom)
  const layerRef = useRef<L.GeoJSON | null>(null)
  // Hover/event handlers close over selectedNhood; without a ref they'd see
  // the value at bind time (mount) and never update.
  const selectedRef = useRef<string | null>(selectedNhood)
  useEffect(() => {
    selectedRef.current = selectedNhood
  }, [selectedNhood])

  useMapEvents({
    zoomend: () => {
      const next = map.getZoom() < hideAtZoom
      setIsFilled((prev) => (prev === next ? prev : next))
    },
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

  // Compute the visual treatment for one polygon. Centralizing this means
  // hover, selection, and dim-the-rest all stay consistent — and a mouseout
  // is just "recompute with hovered=false".
  const styleFor = (name: string, hovered: boolean) => {
    const count = totals.get(name) ?? 0
    const fraction = max > 0 ? count / max : 0
    const fillColor = colorForFraction(fraction)
    const selected = selectedRef.current
    const isSelected = selected != null && selected === name
    const isDimmed = selected != null && !isSelected

    if (isSelected) {
      // Persistent active state — burnt-sienna stroke matching the
      // headline accent so selection across the app (panel "+homes" stat,
      // parcel outline, selected polygon) speaks one warm-amber language.
      return {
        fillColor,
        fillOpacity: isFilled ? 0.4 : 0.15,
        color: '#9a4a31',
        weight: 3,
        opacity: 1,
      }
    }
    if (hovered && !isDimmed) {
      // Subtle bump from the 0.22 default so moving the cursor between a
      // pin (its tooltip card) and the surrounding polygon doesn't feel
      // like crossing a hard boundary. The CSS transition on fill-opacity
      // smooths what's left.
      return {
        fillColor,
        fillOpacity: 0.32,
        color: '#1c2438',
        weight: 2,
        opacity: 1,
      }
    }
    if (isDimmed) {
      return {
        fillColor,
        fillOpacity: isFilled ? 0.06 : 0,
        color: '#1c2438',
        weight: 0.4,
        opacity: 0.18,
      }
    }
    // Default — translucent fill so the basemap reads through. Outline
    // is warm taupe-grey (--ink-faint), which reads as a clean boundary
    // without competing with the navy chrome or the amber ramp. Reads
    // confidently against the cream basemap.
    return {
      fillColor,
      fillOpacity: isFilled ? (count === 0 ? 0 : 0.22) : 0,
      color: '#78716c',
      weight: isFilled ? 0.7 : 0.6,
      opacity: 0.85,
    }
  }

  // Re-apply styles whenever isFilled, selection, or data change. Avoids
  // unmounting all 41 polygons and lets the selected one stay highlighted
  // across zoom-threshold crossings.
  useEffect(() => {
    const layer = layerRef.current
    if (!layer) return
    layer.eachLayer((sub) => {
      const f = (sub as unknown as { feature?: { properties?: { nhood?: string } } }).feature
      const name = f?.properties?.nhood ?? ''
      ;(sub as L.Path).setStyle(styleFor(name, false))
      // Selected polygon goes on top so its heavier stroke isn't clipped
      // by neighbors.
      if (selectedNhood && name === selectedNhood) {
        ;(sub as unknown as { bringToFront: () => void }).bringToFront()
      }
    })
    // styleFor reads selectedRef.current, but we still need the effect to
    // fire on selectedNhood changes — hence including it in deps.
  }, [isFilled, totals, max, selectedNhood])

  if (!geo) return null

  return (
    <GeoJSON
      // Re-mount only when the underlying data changes; isFilled and
      // selectedNhood are handled by the useEffect that re-styles in place.
      key={`choropleth-${permits.length}-${max}`}
      ref={(r) => {
        layerRef.current = r ?? null
      }}
      data={geo}
      // Class on the SVG layer drives `cursor: pointer` (see marker-cluster.css).
      pathOptions={{ className: 'nhood-poly' }}
      style={(feature) => {
        const name = (feature?.properties as { nhood?: string } | undefined)?.nhood ?? ''
        return styleFor(name, false)
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
        layer.on({
          mouseover: (e) => {
            const target = e.target as L.Path
            target.setStyle(styleFor(name, true))
            // Don't yank the selected polygon out from under itself; only
            // raise unselected ones on hover.
            if (selectedRef.current !== name) {
              target.bringToFront()
            }
          },
          mouseout: (e) => {
            const target = e.target as L.Path
            target.setStyle(styleFor(name, false))
            // After mouse leaves, the selected polygon should still sit on top.
            if (selectedRef.current && layerRef.current) {
              layerRef.current.eachLayer((sub) => {
                const f = (sub as unknown as { feature?: { properties?: { nhood?: string } } }).feature
                if (f?.properties?.nhood === selectedRef.current) {
                  ;(sub as unknown as { bringToFront: () => void }).bringToFront()
                }
              })
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
