'use client'
import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, useMap, useMapEvents, GeoJSON, Circle } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import './marker-cluster.css'
import { PermitMarker } from './PermitMarker'
import { MapEventHandler } from './MapEventHandler'
import { NeighborhoodChoropleth } from './NeighborhoodChoropleth'
import { ZoningOverlay } from './ZoningOverlay'
import { ZoningDistrictPanel } from './ZoningDistrictPanel'
import { TransitCorridors } from './TransitCorridors'
import { TransitTierOverlay } from './TransitTierOverlay'
import { TransitTierPanel } from './TransitTierPanel'
import { TIER_ORDER } from '@/lib/transit-tiers-style'
import type { TransitTier } from '@/lib/cross-stats'
import { LensInfoPanel } from './LensInfoPanel'
import { StationMarkers, type SelectedStation } from './StationMarkers'
import { StopFrequencyPanel } from './StopFrequencyPanel'
import { RAIL_STATIONS, RAPID_BUS_STOPS, FREQ_STOPS, stopFreqBand, withinStationRadius, RAIL_THRESHOLD_M, RAPID_BUS_THRESHOLD_M, transitAdjacent, loadStations } from '@/lib/transit-stations'
import { TIER_COLORS } from '@/lib/transit-tiers-style'
import { NeighborhoodPanel } from './NeighborhoodPanel'
import L from 'leaflet'
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson'
import { pointInGeometry } from '@/lib/point-in-polygon'
import { LensRail, type LensMode } from './LensRail'
import { LensDirectory } from './LensDirectory'
import { FilterFAB } from './FilterFAB'
import { FilterSheet } from './FilterSheet'
import { PermitPanel } from './PermitPanel'
import { CoffeeButton } from './CoffeeButton'
import { AboutLink } from './AboutLink'
import {
  permitStage,
  netDelta,
  useCategory,
  STAGE_ORDER,
  STAGE_COLORS,
  STAGE_LABELS,
  CATEGORIES,
  USE_CATEGORY_LABELS,
  type PermitStage,
  type UseCategory,
} from '@/lib/permit-style'
import type { Permit, MapBounds } from '@/lib/types'
import MarkerClusterGroup from 'react-leaflet-cluster'
import { PIN_FADE_MIN, PIN_FADE_MAX, pinOpacity, clusterOpacity } from '@/lib/zoom-fade'

// Inactive (cancelled / denied / expired / etc.) is off-track noise — exclude
// it from the default selection. Users can opt it back in via the filter panel.
const DEFAULT_STAGES: PermitStage[] = STAGE_ORDER.filter((s) => s !== 'inactive')
const ALL_CATEGORIES: UseCategory[] = CATEGORIES

// Canonical URL-parameter defaults — must stay in sync with the useState
// initial values below so that a fresh load never writes default-looking
// params to the URL.
const URL_DEFAULTS = {
  stages: [...DEFAULT_STAGES].sort().join(','),
  cats: [...ALL_CATEGORIES].sort().join(','),
  minUnits: '2',         // matches useState<MinUnitsFilter>(2)
  completedYears: '2',   // matches useState<CompletedYearsFilter>(2)
  recentActivity: '24',  // matches useState<RecentActivityFilter>(24)
}

/**
 * Drives the pin-opacity CSS variable directly on the wrapper element each
 * zoom frame, bypassing React so we don't re-render the whole map tree at
 * 60Hz during a pinch/scroll-zoom. React state only catches the settled
 * zoom on `zoomend` so the mapZoom state updates once per gesture.
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
      if (el) {
        el.style.setProperty('--pin-opacity', String(pinOpacity(map.getZoom())))
        el.style.setProperty('--cluster-opacity', String(clusterOpacity(map.getZoom())))
      }
    },
    zoomend: () => {
      const z = map.getZoom()
      const el = wrapperRef.current
      if (el) {
        el.style.setProperty('--pin-opacity', String(pinOpacity(z)))
        el.style.setProperty('--cluster-opacity', String(clusterOpacity(z)))
      }
      onSettled(z)
    },
  })
  return null
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
  // Pre-computed cross-tabs (neighborhood × zoning × transit). Loaded once
  // on mount; static asset so cached after first request.
  const [crossStats, setCrossStats] = useState<import('@/lib/cross-stats').CrossStats | null>(null)
  // Three-way map lens. 'neighborhoods' is the existing choropleth +
  // panel; 'zoning' swaps the choropleth for zoning districts; 'transit'
  // shows distance-band rings. transitOnly is a permit *filter* and stays
  // independent of the lens — you can have e.g. 'zoning' lens + transit-
  // only permits.
  const [mapMode, setMapMode] = useState<LensMode>('neighborhoods')
  const [transit, setTransit] = useState<'off' | 'rail' | 'rapid-bus' | 'both'>('off')
  const [sheetOpen, setSheetOpen] = useState(false)
  // Default: drawer is open showing whichever lens is active. The directory
  // IS the lens — opening it shouldn't take a second click. Users can dismiss
  // it with the X button, ESC, or by clicking outside.
  const [lensOpen, setLensOpen] = useState<LensMode | null>('neighborhoods')
  const [lensStats, setLensStats] = useState<import('@/lib/lens-stats').LensStats | null>(null)

  // Derived booleans for downstream filter logic
  const railOnly = transit === 'rail' || transit === 'both'
  const rapidBusOnly = transit === 'rapid-bus' || transit === 'both'
  const [selectedStation, setSelectedStation] = useState<SelectedStation | null>(null)
  const [stationRadiusM, setStationRadiusM] = useState<number>(800)  // default rail ½ mi
  const [selectedZoningDistrict, setSelectedZoningDistrict] = useState<{
    zoningSim: string
    gen: string
    districtna?: string
    codesectio?: string
  } | null>(null)
  // Selected transit-access tier (rail / rapid-bus / local-bus / poor).
  // Drives the heat-layer highlight + the TransitTierPanel. Shareable via
  // the ?tier= URL param (mirrors ?district=).
  const [selectedTier, setSelectedTier] = useState<TransitTier | null>(null)
  const [zoningHeights, setZoningHeights] = useState<Record<string, { height_ft?: number; bulk?: string }>>({})
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
    fetch('/cross-stats.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setCrossStats(data))
      .catch(() => setCrossStats(null))
    fetch('/api/lens-stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setLensStats(data))
      .catch(() => setLensStats(null))
    fetch('/zoning-heights.json')
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: { code: string; height_ft?: number; bulk?: string }[]) => {
        const map: Record<string, { height_ft?: number; bulk?: string }> = {}
        for (const r of rows) map[r.code] = { height_ft: r.height_ft, bulk: r.bulk }
        setZoningHeights(map)
      })
      .catch(() => {})
    loadStations().catch(() => {})
  }, [])

  // Client-side viewport bounds — used to cull off-screen markers from the
  // DOM. We don't refetch on pan; just narrow what's rendered.
  const [viewportBounds, setViewportBounds] = useState<MapBounds | null>(null)
  const handleViewportChange = useCallback((b: MapBounds) => {
    setViewportBounds(b)
  }, [])
  const [mapZoom, setMapZoom] = useState<number>(13)

  // Sync side-panel + filter state with URL on mount. Permit / nhood
  // selection plus all five filter values can be encoded in the URL so a
  // shared link reproduces the sender's exact view.
  useEffect(() => {
    // Applies URL search params to the panel/transit/district/browse state.
    // Called on mount AND inside onPop so browser back/forward restores all
    // five new params (transit, station, radius, district, browse) plus
    // permit and nhood.
    // Stages, cats, minUnits, completedYears, recentActivity are intentionally
    // mount-only — they're filter defaults whose round-trip through
    // state→URL→state on popstate could cause feedback loops with the
    // filter-sync effect.
    const applyUrlState = (sp: URLSearchParams) => {
      setOpenPermit(sp.get('permit'))
      setSelectedNhood(sp.get('nhood'))
      const modeParam = sp.get('mode')
      if (modeParam === 'neighborhoods' || modeParam === 'zoning' || modeParam === 'transit') {
        setMapMode(modeParam)
      }
      const lensOpenParam = sp.get('lensOpen')
      if (lensOpenParam === 'neighborhoods' || lensOpenParam === 'zoning' || lensOpenParam === 'transit') {
        setLensOpen(lensOpenParam)
      } else if (lensOpenParam === 'closed') {
        setLensOpen(null)
      }
      // No param → keep the initial open-by-default state set in useState.
      const transitParam = sp.get('transit')
      if (transitParam === 'rail' || transitParam === 'rapid-bus' || transitParam === 'both') {
        setTransit(transitParam)
      } else {
        setTransit('off')
      }
      const stationParam = sp.get('station')
      if (stationParam) {
        const kind: SelectedStation['kind'] = stationParam.startsWith('freq-')
          ? 'freq-stop'
          : stationParam.startsWith('bus-')
            ? 'rapid-bus'
            : 'rail'
        setSelectedStation({ kind, id: stationParam })
      } else {
        setSelectedStation(null)
      }
      const radiusParam = Number(sp.get('radius'))
      if (Number.isFinite(radiusParam) && radiusParam > 0) setStationRadiusM(radiusParam)
      const districtParam = sp.get('district')
      setSelectedZoningDistrict(districtParam ? { zoningSim: districtParam, gen: '' } : null)
      const tierParam = sp.get('tier')
      setSelectedTier(
        tierParam && (TIER_ORDER as string[]).includes(tierParam)
          ? (tierParam as TransitTier)
          : null,
      )
      const sheetParam = sp.get('sheet')
      setSheetOpen(sheetParam === '1')
    }

    const params = new URLSearchParams(window.location.search)
    applyUrlState(params)

    const stagesParam = params.get('stages')
    if (stagesParam) {
      const next = new Set<PermitStage>()
      for (const s of stagesParam.split(',')) {
        if ((STAGE_ORDER as readonly string[]).includes(s)) next.add(s as PermitStage)
      }
      if (next.size > 0) setSelectedStages(next)
    }
    const catsParam = params.get('cats')
    if (catsParam) {
      const next = new Set<UseCategory>()
      for (const c of catsParam.split(',')) {
        if ((CATEGORIES as readonly string[]).includes(c)) next.add(c as UseCategory)
      }
      if (next.size > 0) setSelectedCategories(next)
    }
    if (params.has('minUnits')) {
      const muParam = Number(params.get('minUnits'))
      if ([0, 2, 5, 25, 100].includes(muParam)) setMinUnits(muParam as MinUnitsFilter)
    }
    if (params.has('completedYears')) {
      const cyParam = Number(params.get('completedYears'))
      if ([0, 1, 2, 5].includes(cyParam)) setCompletedYears(cyParam as CompletedYearsFilter)
    }
    if (params.has('recentActivity')) {
      const raParam = Number(params.get('recentActivity'))
      if ([0, 6, 12, 24, 60].includes(raParam)) setRecentActivity(raParam as RecentActivityFilter)
    }

    const onPop = () => {
      applyUrlState(new URLSearchParams(window.location.search))
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Skip the first run so we don't immediately overwrite URL params we
  // just *parsed* on mount with our default state. After that, mirror
  // every filter change into the URL via replaceState so a copy-paste of
  // the location bar (and ShareButton) carries the current view.
  const filterUrlSyncReady = useRef(false)
  useEffect(() => {
    if (!filterUrlSyncReady.current) {
      filterUrlSyncReady.current = true
      return
    }
    const url = new URL(window.location.href)
    const setOrDelete = (key: string, value: string, defaultVal: string) => {
      if (value === defaultVal) url.searchParams.delete(key)
      else url.searchParams.set(key, value)
    }
    setOrDelete('stages', [...selectedStages].sort().join(','), URL_DEFAULTS.stages)
    setOrDelete('cats', [...selectedCategories].sort().join(','), URL_DEFAULTS.cats)
    setOrDelete('minUnits', String(minUnits), URL_DEFAULTS.minUnits)
    setOrDelete('completedYears', String(completedYears), URL_DEFAULTS.completedYears)
    setOrDelete('recentActivity', String(recentActivity), URL_DEFAULTS.recentActivity)

    const transitValue = transit === 'off' ? '' : transit
    setOrDelete('transit', transitValue, '')

    setOrDelete('station', selectedStation?.id ?? '', '')

    // Default radius depends on station kind. Omit when at default.
    const defaultRadius = selectedStation?.kind === 'rapid-bus' ? RAPID_BUS_THRESHOLD_M : RAIL_THRESHOLD_M
    setOrDelete('radius', selectedStation ? String(stationRadiusM) : '', selectedStation ? String(defaultRadius) : '')

    setOrDelete('district', selectedZoningDistrict?.zoningSim ?? '', '')

    setOrDelete('tier', selectedTier ?? '', '')

    setOrDelete('mode', mapMode, 'neighborhoods')

    setOrDelete('lensOpen', lensOpen ?? '', '')

    setOrDelete('sheet', sheetOpen ? '1' : '', '')

    window.history.replaceState({}, '', url.toString())
  }, [selectedStages, selectedCategories, minUnits, completedYears, recentActivity, transit, selectedStation, stationRadiusM, selectedZoningDistrict, selectedTier, mapMode, lensOpen, sheetOpen])

  // Centralized "pan + zoom into a permit" used by both pin clicks and
  // URL-driven loads. Lives in a useEffect on [openPermit, permits] so
  // the centering happens once data is available regardless of *how* the
  // permit became active. lastCenteredPermitRef gates re-centering on
  // unrelated re-renders (filter refetches, viewport pans).
  const lastCenteredPermitRef = useRef<string | null>(null)
  useEffect(() => {
    if (!openPermit) {
      lastCenteredPermitRef.current = null
      return
    }
    if (lastCenteredPermitRef.current === openPermit) return
    if (!permits.length) return
    const map = mapRef.current
    if (!map) return
    const p = permits.find((x) => x.permit_number === openPermit)
    if (!p?.location) return
    lastCenteredPermitRef.current = openPermit

    const [lng, lat] = p.location.coordinates
    const targetZoom = Math.max(map.getZoom(), 18)
    const isWide = typeof window !== 'undefined' && window.innerWidth >= 768
    const px = map.project([lat, lng], targetZoom)
    const shifted = isWide
      ? px.add(L.point(260, 0))
      : px.add(L.point(0, (typeof window !== 'undefined' ? window.innerHeight : 800) * 0.275))
    map.setView(map.unproject(shifted, targetZoom), targetZoom, { animate: true })
  }, [openPermit, permits])

  const openPermitPanel = useCallback(
    (id: string) => {
      setOpenPermit(id)
      const url = new URL(window.location.href)
      url.searchParams.set('permit', id)
      window.history.pushState({}, '', url)
    },
    [],
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

  const openNhoodPanel = useCallback((name: string) => {
    setSelectedNhood(name)
    const url = new URL(window.location.href)
    url.searchParams.set('nhood', name)
    window.history.pushState({}, '', url)
    // The useEffect below handles the fitBounds — same path whether the
    // selection came from a click or from a URL load.
  }, [])

  // Fit the map to the selected neighborhood's polygon. Looks the geometry
  // up from nhoodGeo so click + URL-load paths share one code path.
  // lastFitNhoodRef gates re-fitting on unrelated re-renders.
  const lastFitNhoodRef = useRef<string | null>(null)
  useEffect(() => {
    if (!selectedNhood) {
      lastFitNhoodRef.current = null
      return
    }
    if (lastFitNhoodRef.current === selectedNhood) return
    if (!nhoodGeo) return
    const feature = nhoodGeo.features.find(
      (f) => f.properties?.nhood === selectedNhood,
    )
    if (!feature) return
    const map = mapRef.current
    if (!map) return
    lastFitNhoodRef.current = selectedNhood

    const bounds = L.geoJSON(feature).getBounds()
    const isWide = typeof window !== 'undefined' && window.innerWidth >= 768
    const winH = typeof window !== 'undefined' ? window.innerHeight : 800
    const sheetHeight = isWide ? 0 : Math.round(winH * 0.55)
    const panelWidth = isWide ? 520 : 0
    const paddingTopLeft: [number, number] = [40, 40]
    const paddingBottomRight: [number, number] = [
      panelWidth + 40,
      sheetHeight + 40,
    ]

    const naturalZoom = map.getBoundsZoom(bounds, false, L.point(40, 40))
    const minTargetZoom = PIN_FADE_MAX
    if (naturalZoom >= minTargetZoom) {
      map.fitBounds(bounds, { paddingTopLeft, paddingBottomRight, maxZoom: 15 })
      return
    }
    const targetZoom = Math.min(15, minTargetZoom)
    const centerPx = map.project(bounds.getCenter(), targetZoom)
    const shifted = centerPx.add(L.point(panelWidth / 2, sheetHeight / 2))
    map.setView(map.unproject(shifted, targetZoom), targetZoom, { animate: true })
  }, [selectedNhood, nhoodGeo])

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
        // Global transit-adjacent filter
        if ((railOnly || rapidBusOnly) && !transitAdjacent(p.location?.coordinates, {
          rail: railOnly, rapidBus: rapidBusOnly,
        })) {
          return false
        }
        // Per-station radius filter
        if (selectedStation) {
          const s = lookupStation(selectedStation)
          if (s && !withinStationRadius(p.location?.coordinates, s, stationRadiusM)) return false
        }
        return true
      }),
    [permits, selectedStages, selectedCategories, minUnits, railOnly, rapidBusOnly, selectedStation, stationRadiusM],
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

  const summarySentence = useMemo(() => {
    const cats =
      selectedCategories.size === CATEGORIES.length
        ? 'any use'
        : selectedCategories.size === 0
          ? 'no use types'
          : `${selectedCategories.size} use types`
    const recent =
      recentActivity === 0
        ? 'any time'
        : recentActivity === 6
          ? 'last 6 months'
          : recentActivity === 12
            ? 'last year'
            : recentActivity === 24
              ? 'last 2 years'
              : `last ${recentActivity / 12} years`
    return `${visiblePermits.length} visible · ${cats}, ${recent}.`
  }, [selectedCategories, recentActivity, visiblePermits.length])

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
  const initialClusterOp = clusterOpacity(mapZoom)

  return (
    <div
      ref={wrapperRef}
      className={`relative w-full h-full ${openPermit || selectedNhood ? 'has-selection' : ''}`}
      style={{
        ['--pin-opacity' as string]: String(initialPinOp),
        ['--cluster-opacity' as string]: String(initialClusterOp),
      }}
    >
      {loading && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-paper/40 pointer-events-none">
          <span className="text-sm text-ink-soft bg-paper border border-paper-edge px-3 py-1 rounded shadow-sm">
            Loading…
          </span>
        </div>
      )}
      {error && (
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-paper border border-paper-edge text-ink px-4 py-2 rounded text-sm shadow-md flex items-center gap-2"
          style={{ borderLeft: '3px solid #b35c44' }}
        >
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
        {/* Lens layers — at most one of these renders depending on mapMode.
            Sits below the choropleth + parcel + pins so it's background
            context, not a competing data layer. */}
        {mapMode === 'zoning' && (
          <>
            <ZoningOverlay
              selectedDistrict={selectedZoningDistrict?.zoningSim ?? null}
              onSelect={(zoningSim, gen, districtna, codesectio) =>
                setSelectedZoningDistrict({ zoningSim, gen, districtna, codesectio })
              }
            />
          </>
        )}
        {mapMode === 'transit' && (
          <>
            <TransitTierOverlay
              selectedTier={selectedTier}
              onSelect={setSelectedTier}
            />
            <TransitCorridors />
            <StationMarkers
              show
              zoom={mapZoom}
              onSelect={(s) => {
                setSelectedStation(s)
                setStationRadiusM(s.kind === 'rapid-bus' ? RAPID_BUS_THRESHOLD_M : RAIL_THRESHOLD_M)
              }}
            />
            {selectedStation && (() => {
              const s = lookupStation(selectedStation)
              if (!s) return null
              const color = stationModeColor(selectedStation)
              return (
                <>
                  <Circle
                    center={[s.lat, s.lng]}
                    radius={400}
                    pathOptions={{
                      color, weight: 1, opacity: 0.6,
                      fillColor: color, fillOpacity: 0.08,
                      dashArray: '4 4',
                    }}
                  />
                  <Circle
                    center={[s.lat, s.lng]}
                    radius={160}
                    pathOptions={{
                      color, weight: 1.5, opacity: 0.7,
                      fillColor: color, fillOpacity: 0.18,
                    }}
                  />
                </>
              )
            })()}
          </>
        )}
        {/* Choropleth always rendered. Below PIN_FADE_MIN it carries the
            visualization; above, only the navy stroke remains so neighborhood
            outlines stay visible while inspecting pins. */}
        {mapMode === 'neighborhoods' && (
          <NeighborhoodChoropleth
            permits={filteredPermits}
            hideAtZoom={PIN_FADE_MIN}
            onSelect={openNhoodPanel}
            selectedNhood={selectedNhood}
          />
        )}
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
        <MarkerClusterGroup
          chunkedLoading
          disableClusteringAtZoom={15}
          maxClusterRadius={60}
          spiderfyOnMaxZoom={false}
          showCoverageOnHover={false}
        >
          {visiblePermits.map((p) => (
            <PermitMarker key={p.permit_number} permit={p} onSelect={openPermitPanel} />
          ))}
        </MarkerClusterGroup>
      </MapContainer>
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] flex flex-col items-center">
        <LensRail
          mode={mapMode}
          onChange={(m) => setMapMode(m)}
          open={lensOpen}
          onOpenChange={setLensOpen}
        />
        <LensDirectory
          mode={lensOpen}
          crossStats={crossStats}
          lensStats={lensStats}
          statusLine={summarySentence}
          selectedTier={selectedTier}
          onClose={() => setLensOpen(null)}
          onSelectRegion={(kind, id, extra) => {
            if (kind === 'neighborhood') openNhoodPanel(id)
            else if (kind === 'district') {
              // Specific zoning district click from drill-down — open the
              // existing ZoningDistrictPanel. `extra` carries the gen category.
              setSelectedZoningDistrict({ zoningSim: id, gen: extra ?? '' })
            } else if (kind === 'tier') {
              // Toggle the transit-access tier: re-clicking the active tier
              // clears the highlight + closes the panel.
              setSelectedTier((cur) => (cur === id ? null : (id as TransitTier)))
            }
            // 'zoning' = category click; drill-down handled inside the drawer.
          }}
        />
      </div>
      <FilterFAB
        open={sheetOpen}
        onToggle={() => setSheetOpen((v) => !v)}
      />
      <FilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        mode={mapMode}
        onModeChange={(m) => setMapMode(m)}
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
        transit={transit}
        onTransitChange={setTransit}
      />
      <AboutLink />
      <CoffeeButton />
      <PermitPanel permitNumber={openPermit} onClose={closePermitPanel} />
      <NeighborhoodPanel
        neighborhood={selectedNhood}
        permits={selectedNhood ? (permitsByNhood[selectedNhood] ?? []) : []}
        crossStats={crossStats}
        onClose={closeNhoodPanel}
        onOpenPermit={(id) => {
          closeNhoodPanel()
          openPermitPanel(id)
        }}
      />

      {/* Lens info panels — opened by clicking a polygon in zoning or
          transit mode. Both share LensInfoPanel chrome. */}
      <ZoningDistrictPanel
        zoningSim={selectedZoningDistrict?.zoningSim ?? null}
        gen={selectedZoningDistrict?.gen ?? null}
        districtName={selectedZoningDistrict?.districtna}
        codeSection={selectedZoningDistrict?.codesectio}
        heightFt={selectedZoningDistrict ? zoningHeights[selectedZoningDistrict.zoningSim]?.height_ft : undefined}
        bulk={selectedZoningDistrict ? zoningHeights[selectedZoningDistrict.zoningSim]?.bulk : undefined}
        permitCountInDistrict={filteredPermits.length}
        onDrillToDistrict={(zoningSim) => {
          const url = new URL(window.location.href)
          url.searchParams.set('district', zoningSim)
          window.history.pushState({}, '', url)
        }}
        onClose={() => setSelectedZoningDistrict(null)}
      />
      <StationPanel
        selected={selectedStation?.kind === 'freq-stop' ? null : selectedStation}
        radiusM={stationRadiusM}
        onClose={() => setSelectedStation(null)}
        onRadiusChange={setStationRadiusM}
        permits={filteredPermits}
        onOpenPermit={openPermitPanel}
      />
      <StopFrequencyPanel
        stopId={selectedStation?.kind === 'freq-stop' ? selectedStation.id : null}
        onClose={() => setSelectedStation(null)}
      />
      <TransitTierPanel
        tier={selectedTier}
        stats={crossStats?.transit_tiers ?? []}
        lens={lensStats?.transit_tiers ?? null}
        permits={filteredPermits}
        onOpenPermit={openPermitPanel}
        onClose={() => setSelectedTier(null)}
      />
    </div>
  )
}

/** Coordinates for any selected station, across all three marker layers. */
function lookupStation(s: SelectedStation): { lat: number; lng: number } | undefined {
  if (s.kind === 'rail') return RAIL_STATIONS.find((x) => x.id === s.id)
  if (s.kind === 'rapid-bus') return RAPID_BUS_STOPS.find((x) => x.id === s.id)
  return FREQ_STOPS.find((x) => x.id === s.id)
}

function stationModeColor(s: SelectedStation): string {
  if (s.kind === 'rapid-bus') return '#9a4a31'
  if (s.kind === 'freq-stop') {
    const stop = FREQ_STOPS.find((x) => x.id === s.id)
    return stop ? TIER_COLORS[stopFreqBand(stop)] : '#9a4a31'
  }
  const station = RAIL_STATIONS.find((r) => r.id === s.id)
  if (!station) return '#1c2438'
  if (station.modes.includes('bart')) return '#1c2438'
  if (station.modes.includes('caltrain')) return '#b08968'
  return '#7d9b76'
}

function StationPanel({
  selected,
  radiusM,
  onClose,
  onRadiusChange,
  permits,
  onOpenPermit,
}: {
  selected: SelectedStation | null
  radiusM: number
  onClose: () => void
  onRadiusChange: (m: number) => void
  permits: Permit[]
  onOpenPermit: (id: string) => void
}) {
  const open = !!selected
  const station = selected
    ? (selected.kind === 'rail'
        ? RAIL_STATIONS.find((s) => s.id === selected.id)
        : RAPID_BUS_STOPS.find((s) => s.id === selected.id))
    : null

  const isRail = selected?.kind === 'rail'
  const radiusOptions = isRail ? [400, 800, 1600] : [160, 400]

  // Permits within the current radius — computed once here
  const shedPermits = station
    ? permits.filter((p) => {
        const c = p.location?.coordinates
        if (!c) return false
        return withinStationRadius(c, station, radiusM)
      })
    : []

  // Top 5 most recent
  const recentPermits = [...shedPermits]
    .filter((p) => !!p.status_date)
    .sort((a, b) => (a.status_date! < b.status_date! ? 1 : -1))
    .slice(0, 5)

  // Zoning categories in shed
  const zoningCounts: Record<string, number> = {}
  for (const p of shedPermits) {
    const cat = useCategory(p.proposed_use ?? p.existing_use)
    const label = USE_CATEGORY_LABELS[cat]
    zoningCounts[label] = (zoningCounts[label] ?? 0) + 1
  }
  const zoningEntries = Object.entries(zoningCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({
      label,
      value: `${shedPermits.length > 0 ? Math.round((count / shedPermits.length) * 100) : 0}%`,
      pct: shedPermits.length > 0 ? count / shedPermits.length : 0,
      color: '#7d9b76',
    }))

  const subtitle = (() => {
    if (!station) return undefined
    if ('modes' in station) return `Modes: ${station.modes.join(' / ')}`
    if ('routes' in station) return `Routes: ${station.routes.join(', ')}`
    return undefined
  })()

  // Build rows as plain summary text — radius rows show current selection.
  const rows = radiusOptions.map((m) => ({
    label: `${m} m${m === radiusM ? '  ✓' : ''}`,
    value: '',
    pct: m === radiusM ? 1 : 0.15,
    color: '#9a4a31',
  }))

  return (
    <>
      <LensInfoPanel
        open={open}
        eyebrow={isRail ? 'Rail station' : 'Rapid bus stop'}
        title={station?.name ?? '—'}
        subtitle={subtitle}
        hero={
          station
            ? { eyebrow: 'Permits in shed', value: String(shedPermits.length), detail: `${radiusM} m radius` }
            : undefined
        }
        primary={{ eyebrow: 'Use mix in shed', rows: zoningEntries }}
        secondary={{ eyebrow: 'Radius options', rows }}
        onClose={onClose}
      >
        {/* Recent permits in shed */}
        {recentPermits.length > 0 && (
          <div className="pt-5 border-t border-paper-edge">
            <div className="civic-eyebrow mb-3">Recent permits in shed</div>
            <ul className="space-y-2">
              {recentPermits.map((p) => {
                const stage = permitStage(p)
                const stageColor = STAGE_COLORS[stage].fill
                const stageLabel = STAGE_LABELS[stage].split(' / ')[0].split(' · ')[0]
                return (
                  <li key={p.permit_number}>
                    <button
                      type="button"
                      onClick={() => { onOpenPermit(p.permit_number); onClose() }}
                      className="w-full text-left flex items-start gap-2 hover:bg-paper-deep -mx-2 px-2 py-1.5 rounded transition-colors"
                    >
                      <span
                        className="text-[10px] font-semibold uppercase tracking-wide shrink-0 w-20 pt-0.5"
                        style={{ color: stageColor }}
                      >
                        {stageLabel}
                      </span>
                      <span className="font-serif text-ink text-sm leading-snug min-w-0 line-clamp-2">
                        {p.address}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </LensInfoPanel>
      {/* Sibling control: clickable radius pills under the panel.
          LensInfoPanel rows are display-only, so we layer the actual control
          here, positioned to align with the panel chrome. */}
      {open && (
        <div
          className="absolute z-[1101] left-4 bottom-4 bg-paper border border-paper-edge rounded-md shadow-md px-3 py-2 flex gap-1.5 items-center"
          role="group"
          aria-label="Radius selector"
        >
          <span className="text-[10px] uppercase tracking-wider text-ink-faint mr-1">Radius</span>
          {radiusOptions.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onRadiusChange(m)}
              className={`px-2 py-1 text-xs rounded border transition ${
                m === radiusM
                  ? 'bg-ink text-paper border-ink font-semibold'
                  : 'bg-paper text-ink-soft border-paper-edge hover:border-ink'
              }`}
            >
              {m} m
            </button>
          ))}
        </div>
      )}
    </>
  )
}

