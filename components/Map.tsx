'use client'
import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, useMap, useMapEvents, GeoJSON } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import './marker-cluster.css'
import { PermitMarker } from './PermitMarker'
import { MapEventHandler } from './MapEventHandler'
import { NeighborhoodChoropleth } from './NeighborhoodChoropleth'
import { NeighborhoodPanel } from './NeighborhoodPanel'
import L from 'leaflet'
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
// Inactive (cancelled / denied / expired / etc.) is off-track noise — exclude
// it from the default selection. Users can opt it back in via the filter panel.
const DEFAULT_STAGES: PermitStage[] = STAGE_ORDER.filter((s) => s !== 'inactive')
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
 * Drives the pin-opacity CSS variable directly on the wrapper element each
 * zoom frame, bypassing React so we don't re-render the whole map tree at
 * 60Hz during a pinch/scroll-zoom. React state only catches the settled
 * zoom on `zoomend` so gates like ZoomGatedPins update once per gesture.
 */
function ZoomTracker({
  onSettled,
  wrapperRef,
}: {
  onSettled: (z: number) => void
  wrapperRef: React.RefObject<HTMLDivElement | null>
}) {
  const map = useMap()
  useMapEvents({
    zoom: () => {
      const el = wrapperRef.current
      if (el) el.style.setProperty('--pin-opacity', String(pinOpacity(map.getZoom())))
    },
    zoomend: () => {
      const z = map.getZoom()
      const el = wrapperRef.current
      if (el) el.style.setProperty('--pin-opacity', String(pinOpacity(z)))
      onSettled(z)
    },
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

export type MinUnitsFilter = 0 | 2 | 5 | 25 | 100
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
    () => new Set(DEFAULT_STAGES),
  )
  const [minUnits, setMinUnits] = useState<MinUnitsFilter>(2)
  const [completedYears, setCompletedYears] = useState<CompletedYearsFilter>(2)
  const [recentActivity, setRecentActivity] = useState<RecentActivityFilter>(24)
  const [selectedCategories, setSelectedCategories] = useState<Set<UseCategory>>(
    () => new Set(ALL_CATEGORIES),
  )
  const [openPermit, setOpenPermit] = useState<string | null>(null)
  const [selectedNhood, setSelectedNhood] = useState<string | null>(null)
  const [nhoodGeo, setNhoodGeo] = useState<FeatureCollection<MultiPolygon | Polygon, { nhood: string }> | null>(null)
  // Parcel polygon for the currently-open permit. Fetched lazily from
  // /api/parcel and rendered as a thin amber outline under the marker so
  // the user can see which lot the project sits on.
  const [parcelShape, setParcelShape] = useState<Polygon | MultiPolygon | null>(null)
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

  const openPermitPanel = useCallback(
    (id: string) => {
      setOpenPermit(id)
      const url = new URL(window.location.href)
      url.searchParams.set('permit', id)
      window.history.pushState({}, '', url)

      const map = mapRef.current
      const p = permits.find((x) => x.permit_number === id)
      if (!map || !p?.location) return

      // Zoom in far enough that the parcel polygon is clearly larger than
      // the marker pin — at z18 a typical SF parcel is ~80–120px while the
      // pin is ~20–30px. Don't zoom *out* if the user's already deeper.
      const [lng, lat] = p.location.coordinates
      const targetZoom = Math.max(map.getZoom(), 18)
      const isWide = typeof window !== 'undefined' && window.innerWidth >= 768
      const px = map.project([lat, lng], targetZoom)
      // Shift the map's geographic center away from the panel so the pin
      // lands in the still-visible portion: ~half the panel width on
      // desktop (right drawer); ~half the bottom-sheet height on mobile.
      const shifted = isWide
        ? px.add(L.point(260, 0))
        : px.add(L.point(0, (typeof window !== 'undefined' ? window.innerHeight : 800) * 0.275))
      map.setView(map.unproject(shifted, targetZoom), targetZoom, { animate: true })
    },
    [permits],
  )

  const closePermitPanel = useCallback(() => {
    setOpenPermit(null)
    setParcelShape(null)
    const url = new URL(window.location.href)
    url.searchParams.delete('permit')
    window.history.pushState({}, '', url)
  }, [])

  // Fetch the parcel polygon for the currently-open permit. Cached on the
  // server (24h) and per browser session via SWR-style caching headers.
  useEffect(() => {
    if (!openPermit) {
      setParcelShape(null)
      return
    }
    const p = permits.find((x) => x.permit_number === openPermit)
    if (!p?.block || !p?.lot) {
      setParcelShape(null)
      return
    }
    const ctrl = new AbortController()
    const url = `/api/parcel?block=${encodeURIComponent(p.block)}&lot=${encodeURIComponent(p.lot)}`
    fetch(url, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.shape) setParcelShape(data.shape as Polygon | MultiPolygon)
        else setParcelShape(null)
      })
      .catch(() => {
        // Ignore aborts and fetch failures — the parcel outline is non-essential.
      })
    return () => ctrl.abort()
  }, [openPermit, permits])

  const openNhoodPanel = useCallback((name: string, bounds: L.LatLngBounds) => {
    setSelectedNhood(name)
    const url = new URL(window.location.href)
    url.searchParams.set('nhood', name)
    window.history.pushState({}, '', url)
    const map = mapRef.current
    if (!map) return
    // On desktop the 520px panel slides in from the right and would cover
    // the polygon if we fit-bounds against the full map. Reserve that space
    // so the neighborhood lands in the still-visible left portion. Mobile
    // panel takes the whole screen — symmetric padding is fine.
    const isWide = typeof window !== 'undefined' && window.innerWidth >= 768
    const panelOffset = isWide ? 520 : 0
    const paddingTopLeft: [number, number] = [40, 40]
    const paddingBottomRight: [number, number] = [panelOffset + 40, 40]

    // Pins fade in starting at PIN_FADE_MIN; for the user to actually see
    // the icons in the selected neighborhood we want the natural fit to
    // reach PIN_FADE_MAX. If the polygon is so large it'd otherwise fit at
    // a lower zoom, override and zoom to a target the pins are visible at.
    const naturalZoom = map.getBoundsZoom(bounds, false, L.point(40, 40))
    const minTargetZoom = PIN_FADE_MAX
    if (naturalZoom >= minTargetZoom) {
      map.fitBounds(bounds, { paddingTopLeft, paddingBottomRight, maxZoom: 15 })
      return
    }
    // Polygon is too big to fit at pin-visible zoom — re-center on it at
    // the threshold zoom, shifting the visible center to account for the
    // side panel so the neighborhood doesn't land behind the drawer.
    const targetZoom = Math.min(15, minTargetZoom)
    const centerPx = map.project(bounds.getCenter(), targetZoom)
    const shifted = centerPx.add(L.point(panelOffset / 2, 0))
    map.setView(map.unproject(shifted, targetZoom), targetZoom, { animate: true })
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

  // The --pin-opacity CSS variable is written directly to wrapperRef.current
  // by ZoomTracker on every zoom frame. We seed it via inline style for the
  // first paint (using the settled zoom from React state) and never let
  // React touch it again during animation — that's the whole point.
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const initialPinOp = pinOpacity(mapZoom)

  return (
    <div
      ref={wrapperRef}
      className="relative w-full h-full"
      style={{ ['--pin-opacity' as string]: String(initialPinOp) }}
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
        <ZoomTracker onSettled={setMapZoom} wrapperRef={wrapperRef} />
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
          selectedNhood={selectedNhood}
        />
        {parcelShape && (
          <GeoJSON
            // Re-mount when the parcel changes so Leaflet picks up the new geometry.
            key={`parcel-${openPermit}`}
            data={parcelShape}
            style={{
              // Burnt sienna — same accent the panel headline uses, so the
              // selected-permit "thread" reads consistently across surfaces.
              color: '#9a4a31',
              weight: 2.5,
              opacity: 1,
              fillColor: '#b08968',
              fillOpacity: 0.2,
              interactive: false,
            }}
          />
        )}
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
