'use client'
import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import './marker-cluster.css'
import { PermitMarker } from './PermitMarker'
import { MapEventHandler } from './MapEventHandler'
import { NeighborhoodChoropleth } from './NeighborhoodChoropleth'
import { NeighborhoodPanel } from './NeighborhoodPanel'
import type * as L from 'leaflet'
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson'
import { pointInGeometry } from '@/lib/point-in-polygon'
import { FilterPanel } from './FilterPanel'
import { PermitPanel } from './PermitPanel'
import { CoffeeButton } from './CoffeeButton'
import {
  permitStage,
  netDelta,
  useCategory,
  STAGE_ORDER,
  CATEGORIES,
  type PermitStage,
  type UseCategory,
} from '@/lib/permit-style'
import type { Permit, MapBounds } from '@/lib/types'

const ALL_STAGES: PermitStage[] = STAGE_ORDER
const ALL_CATEGORIES: UseCategory[] = CATEGORIES
// Pins fade in across this band — choropleth is the visualization below
// PIN_FADE_MIN, individual pins above PIN_FADE_MAX. Between, both render
// with a smooth opacity ramp so there's no abrupt swap.
const PIN_FADE_MIN = 13.5
const PIN_FADE_MAX = 14.5

function pinOpacity(zoom: number): number {
  if (zoom <= PIN_FADE_MIN) return 0
  if (zoom >= PIN_FADE_MAX) return 1
  return (zoom - PIN_FADE_MIN) / (PIN_FADE_MAX - PIN_FADE_MIN)
}

/**
 * Tracks the live map zoom and pushes it to the parent. Listens on `zoom`
 * (during-zoom) so opacity transitions start the moment zoom begins —
 * not after `zoomend` fires post-animation.
 */
function ZoomTracker({ onZoom }: { onZoom: (z: number) => void }) {
  const map = useMap()
  useMapEvents({
    zoom: () => onZoom(map.getZoom()),
    zoomend: () => onZoom(map.getZoom()),
  })
  return null
}

/**
 * Renders pins above PIN_FADE_MIN. Actual opacity ramp is applied via the
 * --pin-opacity CSS variable set on the outer wrapper, so Leaflet's
 * DivIcon DOM (attached to the marker-pane, not as React children) picks
 * it up through inheritance.
 */
function ZoomGatedPins({
  visiblePermits,
  onSelect,
  zoom,
}: {
  visiblePermits: Permit[]
  onSelect: (id: string) => void
  zoom: number
}) {
  if (pinOpacity(zoom) <= 0) return null
  return (
    <>
      {visiblePermits.map((p) => (
        <PermitMarker key={p.permit_number} permit={p} onSelect={onSelect} />
      ))}
    </>
  )
}

export type MinUnitsFilter = 0 | 5 | 25 | 100
export type CompletedYearsFilter = 0 | 1 | 2 | 5
export type RecentActivityFilter = 0 | 6 | 12 | 24 | 60 // months; 0 = any

interface Props {
  initialCenter?: [number, number]
}

export default function Map({ initialCenter = [37.7749, -122.4194] }: Props) {
  const [permits, setPermits] = useState<Permit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedStages, setSelectedStages] = useState<Set<PermitStage>>(
    () => new Set(ALL_STAGES),
  )
  const [minUnits, setMinUnits] = useState<MinUnitsFilter>(0)
  const [completedYears, setCompletedYears] = useState<CompletedYearsFilter>(2)
  const [recentActivity, setRecentActivity] = useState<RecentActivityFilter>(0)
  const [selectedCategories, setSelectedCategories] = useState<Set<UseCategory>>(
    () => new Set(ALL_CATEGORIES),
  )
  const [openPermit, setOpenPermit] = useState<string | null>(null)
  const [selectedNhood, setSelectedNhood] = useState<string | null>(null)
  const [nhoodGeo, setNhoodGeo] = useState<FeatureCollection<MultiPolygon | Polygon, { nhood: string }> | null>(null)
  const mapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    fetch('/sf-neighborhoods.geojson')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
      .then(setNhoodGeo)
      .catch(() => setNhoodGeo(null))
  }, [])
  // Client-side viewport bounds — used to cull off-screen markers from the
  // DOM. We don't refetch on pan; just narrow what's rendered.
  const [viewportBounds, setViewportBounds] = useState<MapBounds | null>(null)
  const handleViewportChange = useCallback((b: MapBounds) => {
    setViewportBounds(b)
  }, [])
  const [mapZoom, setMapZoom] = useState<number>(13)

  // Sync the side-panel state with URL (?permit=<id> or ?nhood=<name>)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const ip = params.get('permit')
    if (ip) setOpenPermit(ip)
    const inh = params.get('nhood')
    if (inh) setSelectedNhood(inh)
    const onPop = () => {
      const sp = new URLSearchParams(window.location.search)
      setOpenPermit(sp.get('permit'))
      setSelectedNhood(sp.get('nhood'))
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const openPermitPanel = useCallback((id: string) => {
    setOpenPermit(id)
    const url = new URL(window.location.href)
    url.searchParams.set('permit', id)
    window.history.pushState({}, '', url)
  }, [])

  const closePermitPanel = useCallback(() => {
    setOpenPermit(null)
    const url = new URL(window.location.href)
    url.searchParams.delete('permit')
    window.history.pushState({}, '', url)
  }, [])

  const openNhoodPanel = useCallback((name: string, bounds: L.LatLngBounds) => {
    setSelectedNhood(name)
    const url = new URL(window.location.href)
    url.searchParams.set('nhood', name)
    window.history.pushState({}, '', url)
    if (mapRef.current) {
      mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 })
    }
  }, [])

  const closeNhoodPanel = useCallback(() => {
    setSelectedNhood(null)
    const url = new URL(window.location.href)
    url.searchParams.delete('nhood')
    window.history.pushState({}, '', url)
  }, [])

  const toggleStage = useCallback((stage: PermitStage) => {
    setSelectedStages((prev) => {
      const next = new Set(prev)
      if (next.has(stage)) next.delete(stage)
      else next.add(stage)
      return next
    })
  }, [])

  const toggleCategory = useCallback((cat: UseCategory) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }, [])

  // Pre-bounds filter: stage + category + housing delta. Memoized separately
  // so a viewport pan doesn't invalidate this expensive pass.
  const filteredPermits = useMemo(
    () =>
      permits.filter((p) => {
        if (!selectedStages.has(permitStage(p))) return false
        const cat = useCategory(p.proposed_use ?? p.existing_use)
        if (!selectedCategories.has(cat)) return false
        if (minUnits > 0 && cat === 'housing') {
          const delta = netDelta(p.existing_units, p.proposed_units)
          if (delta == null || delta < minUnits) return false
        }
        return true
      }),
    [permits, selectedStages, selectedCategories, minUnits],
  )

  // Permits grouped by neighborhood (point-in-polygon). Lifted up here so
  // the choropleth and the neighborhood panel share one computation.
  // (Record, not Map<>, because this file's default export is named `Map`
  // and shadows the global Map constructor.)
  const permitsByNhood = useMemo<Record<string, Permit[]>>(() => {
    const out: Record<string, Permit[]> = {}
    if (!nhoodGeo) return out
    for (const p of filteredPermits) {
      if (!p.location) continue
      const [lng, lat] = p.location.coordinates
      for (const f of nhoodGeo.features) {
        if (pointInGeometry(lng, lat, f.geometry)) {
          const name = f.properties?.nhood ?? ''
          if (!out[name]) out[name] = []
          out[name].push(p)
          break
        }
      }
    }
    return out
  }, [nhoodGeo, filteredPermits])

  // Viewport cull — only render permits within the current map bounds plus
  // a 25% buffer so pins near the edge don't pop in/out during a pan.
  // Massive perf win: at default zoom we render ~150-300 instead of all 1800.
  const visiblePermits = useMemo(() => {
    if (!viewportBounds) return filteredPermits
    const latBuffer = (viewportBounds.north - viewportBounds.south) * 0.25
    const lngBuffer = (viewportBounds.east - viewportBounds.west) * 0.25
    const n = viewportBounds.north + latBuffer
    const s = viewportBounds.south - latBuffer
    const e = viewportBounds.east + lngBuffer
    const w = viewportBounds.west - lngBuffer
    return filteredPermits.filter((p) => {
      if (!p.location) return false
      const [lng, lat] = p.location.coordinates
      return lat >= s && lat <= n && lng >= w && lng <= e
    })
  }, [filteredPermits, viewportBounds])

  // Single fetch keyed only by filter values — no bounds, no per-pan refetch.
  // Vercel caches the result so all users hit the same warm entry.
  // Panning/zooming filters client-side from this cached list.
  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true)
    setError(null)
    const params = new URLSearchParams()
    params.set('completedYears', String(completedYears))
    if (recentActivity > 0) params.set('recentMonths', String(recentActivity))
    fetch(`/api/permits?${params}`, { signal: ctrl.signal })
      .then((res) => {
        if (!res.ok) throw new Error('fetch failed')
        return res.json() as Promise<Permit[]>
      })
      .then((data) => {
        setPermits(data)
        setLoading(false)
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return
        setError('Data temporarily unavailable. Please try again.')
        setLoading(false)
      })
    return () => ctrl.abort()
  }, [completedYears, recentActivity])

  // CSS custom property → inherited by .permit-pin via marker-cluster.css.
  // Leaflet attaches markers to .leaflet-marker-pane (not as React children),
  // so we can't wrap them in a div with opacity — but the CSS var on the
  // outer wrapper cascades through to all DivIcon HTML.
  const pinOp = pinOpacity(mapZoom)

  return (
    <div
      className="relative w-full h-full"
      style={{ ['--pin-opacity' as string]: String(pinOp) }}
    >
      {loading && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-white/40 pointer-events-none">
          <span className="text-sm text-gray-600 bg-white px-3 py-1 rounded shadow">Loading…</span>
        </div>
      )}
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-red-50 border border-red-300 text-red-700 px-4 py-2 rounded text-sm shadow">
          {error}
        </div>
      )}
      <MapContainer
        center={initialCenter}
        zoom={13}
        className="w-full h-full"
        ref={(m) => {
          mapRef.current = m ?? null
        }}
      >
        <ZoomTracker onZoom={setMapZoom} />
        {/* Carto Voyager: gives water (soft blue), parks (sage), and street
            hierarchy out of the box. Labels-under variant keeps streets/place
            names but de-emphasizes them so pins still dominate. */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={19}
        />
        <MapEventHandler onBoundsChange={handleViewportChange} />
        {/* Choropleth always rendered. Below PIN_FADE_MIN it carries the
            visualization; above, only the navy stroke remains so neighborhood
            outlines stay visible while inspecting pins. */}
        <NeighborhoodChoropleth
          permits={filteredPermits}
          hideAtZoom={PIN_FADE_MIN}
          onSelect={openNhoodPanel}
        />
        <ZoomGatedPins
          visiblePermits={visiblePermits}
          onSelect={openPermitPanel}
          zoom={mapZoom}
        />
      </MapContainer>
      <FilterPanel
        selectedStages={selectedStages}
        onToggleStage={toggleStage}
        onSetStages={setSelectedStages}
        selectedCategories={selectedCategories}
        onToggleCategory={toggleCategory}
        onSetCategories={setSelectedCategories}
        minUnits={minUnits}
        onMinUnitsChange={setMinUnits}
        completedYears={completedYears}
        onCompletedYearsChange={setCompletedYears}
        recentActivity={recentActivity}
        onRecentActivityChange={setRecentActivity}
        visibleCount={visiblePermits.length}
        totalCount={permits.length}
      />
      <CoffeeButton />
      <PermitPanel permitNumber={openPermit} onClose={closePermitPanel} />
      <NeighborhoodPanel
        neighborhood={selectedNhood}
        permits={selectedNhood ? (permitsByNhood[selectedNhood] ?? []) : []}
        onClose={closeNhoodPanel}
        onOpenPermit={(id) => {
          closeNhoodPanel()
          openPermitPanel(id)
        }}
      />
    </div>
  )
}
