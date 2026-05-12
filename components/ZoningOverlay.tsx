'use client'
import { GeoJSON, Marker, useMap, useMapEvents } from 'react-leaflet'
import { useEffect, useMemo, useState } from 'react'
import L from 'leaflet'
import type { FeatureCollection, Polygon, MultiPolygon, Position } from 'geojson'
import { getZoningIntensity } from '@/lib/zoning-intensity'

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

// Within-gen opacity ramp. Combined with the shared gen hue this produces
// a "denser = stronger fill" reading without losing the family grouping.
function fillOpacityFor(zoningSim: string, intensity = getZoningIntensity(zoningSim)): number {
  return 0.08 + intensity * 0.32
}

// Bounding-box center — fine for placing a label, much cheaper than a true
// centroid and good enough since the user just needs to see the code.
function geomCenter(geom: Polygon | MultiPolygon): [number, number] | null {
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity
  const visit = (coords: Position | Position[] | Position[][] | Position[][][]) => {
    if (typeof (coords as Position)[0] === 'number') {
      const [lng, lat] = coords as Position
      if (lng < minLng) minLng = lng
      if (lng > maxLng) maxLng = lng
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
    } else {
      for (const c of coords as Position[] | Position[][] | Position[][][]) visit(c)
    }
  }
  visit(geom.coordinates)
  if (!Number.isFinite(minLng)) return null
  return [(minLat + maxLat) / 2, (minLng + maxLng) / 2]
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

const ZONING_CACHE_KEY = 'wbsf-zoning-v1'

interface Props {
  selectedDistrict?: string | null
  onSelect?: (zoningSim: string, gen: string, districtna?: string, codesectio?: string) => void
  /** Fires once after geo loads so a parent that only knows the zoning code
   *  (e.g. URL deep-link `?district=RH-3`) can hydrate its display fields. */
  onResolveDistrict?: (zoningSim: string, gen: string, districtna?: string, codesectio?: string) => void
}

export function ZoningOverlay({ selectedDistrict = null, onSelect, onResolveDistrict }: Props = {}) {
  const [geo, setGeo] = useState<ZoningGeo | null>(null)

  useEffect(() => {
    if (!geo || !selectedDistrict || !onResolveDistrict) return
    const match = geo.features.find((f) => f.properties?.zoning_sim === selectedDistrict)
    if (!match) return
    const p = match.properties
    onResolveDistrict(p.zoning_sim || '', p.gen || '', p.districtna || undefined, p.codesectio || undefined)
  }, [geo, selectedDistrict, onResolveDistrict])

  useEffect(() => {
    // Seed from localStorage for instant paint on subsequent loads
    try {
      const cached = window.localStorage.getItem(ZONING_CACHE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached) as ZoningGeo
        if (parsed && parsed.features?.length > 0) setGeo(parsed)
      }
    } catch {}

    const ctrl = new AbortController()
    let cancelled = false
    let attempts = 0

    const load = () => {
      fetch('/zoning.geojson', { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: ZoningGeo | null) => {
          if (cancelled) return
          if (data && data.type === 'FeatureCollection' && data.features?.length > 0) {
            setGeo(data)
            try {
              window.localStorage.setItem(ZONING_CACHE_KEY, JSON.stringify(data))
            } catch {}
          } else if (attempts < 2) {
            attempts++
            setTimeout(load, 2000)
          }
        })
        .catch((err: Error) => {
          if (err.name === 'AbortError' || cancelled) return
          if (attempts < 2) {
            attempts++
            setTimeout(load, 2000)
          }
        })
    }
    load()

    return () => {
      cancelled = true
      ctrl.abort()
    }
  }, [])

  if (!geo) return null

  return (
    <>
    <GeoJSON
      // Re-mount when selection changes so styles re-apply (highlight the
      // selected category with bumped opacity + heavier stroke).
      key={`zoning-overlay-${selectedDistrict ?? 'none'}`}
      data={geo}
      pathOptions={{ className: 'zoning-poly' }}
      style={(feature) => {
        const fProps = feature?.properties as ZoningProperties | undefined
        const gen = fProps?.gen ?? 'Other'
        const fill = genColor(gen)
        const isSel = selectedDistrict != null && fProps?.zoning_sim === selectedDistrict
        const isDimmed = selectedDistrict != null && !isSel
        const baseOpacity = fillOpacityFor(fProps?.zoning_sim ?? '')
        return {
          fillColor: fill,
          fillOpacity: isSel ? 0.55 : isDimmed ? 0.04 : baseOpacity,
          color: fill,
          weight: isSel ? 1.6 : 0.5,
          opacity: isSel ? 1 : isDimmed ? 0.25 : 0.6,
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
        if (onSelect) {
          layer.on({
            click: () => {
              const zoningSim = props.zoning_sim || ''
              const gen = props.gen || 'Other'
              const districtna = props.districtna || undefined
              const codesectio = props.codesectio || undefined
              onSelect(zoningSim, gen, districtna, codesectio)
            },
          })
        }
      }}
    />
    <ZoningLabels geo={geo} />
    </>
  )
}

const LABEL_MIN_ZOOM = 17

/** Per-polygon code labels that fade in at high zoom. Centroids are
 *  precomputed; viewport filtering keeps the rendered Marker count to
 *  whatever's actually on screen (typically 20–60 at zoom ≥ 15). */
function ZoningLabels({ geo }: { geo: ZoningGeo }) {
  const map = useMap()
  const [view, setView] = useState(() => ({
    zoom: map.getZoom(),
    bounds: map.getBounds(),
  }))

  useMapEvents({
    zoomend: () => setView({ zoom: map.getZoom(), bounds: map.getBounds() }),
    moveend: () => setView({ zoom: map.getZoom(), bounds: map.getBounds() }),
  })

  const centroids = useMemo(() => {
    return geo.features.map((f) => ({
      center: geomCenter(f.geometry),
      code: f.properties.zoning_sim || '',
    }))
  }, [geo])

  if (view.zoom < LABEL_MIN_ZOOM) return null

  const visible = centroids.filter(
    (c) => c.center && c.code && view.bounds.contains(c.center as L.LatLngTuple),
  )

  return (
    <>
      {visible.map((c, i) => (
        <Marker
          key={`${c.code}-${i}`}
          position={c.center as L.LatLngTuple}
          interactive={false}
          icon={L.divIcon({
            className: 'zoning-code-label',
            html: `<span>${c.code}</span>`,
            iconSize: [70, 16],
            iconAnchor: [35, 8],
          })}
        />
      ))}
    </>
  )
}

export const ZONING_LEGEND: { gen: string; color: string }[] = [
  { gen: 'Residential', color: GEN_COLORS.Residential },
  { gen: 'Mixed Use', color: GEN_COLORS['Mixed Use'] },
  { gen: 'Commercial', color: GEN_COLORS.Commercial },
  { gen: 'Industrial', color: GEN_COLORS.Industrial },
]
