'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { MapContainer, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import './marker-cluster.css'
import { PermitMarker } from './PermitMarker'
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
import type { Permit } from '@/lib/types'

const ALL_STAGES: PermitStage[] = STAGE_ORDER
const ALL_CATEGORIES: UseCategory[] = CATEGORIES

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

  // Sync the side-panel state with ?permit=<id> in the URL so deep links work.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const initial = params.get('permit')
    if (initial) setOpenPermit(initial)
    const onPop = () => {
      const sp = new URLSearchParams(window.location.search)
      setOpenPermit(sp.get('permit'))
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

  const visiblePermits = useMemo(
    () =>
      permits.filter((p) => {
        if (!selectedStages.has(permitStage(p))) return false
        const cat = useCategory(p.proposed_use ?? p.existing_use)
        if (!selectedCategories.has(cat)) return false
        // minUnits applies only to the housing category (which now also
        // includes hotels/motels — see useCategory).
        if (minUnits > 0 && cat === 'housing') {
          const delta = netDelta(p.existing_units, p.proposed_units)
          if (delta == null || delta < minUnits) return false
        }
        return true
      }),
    [permits, selectedStages, selectedCategories, minUnits],
  )

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

  return (
    <div className="relative w-full h-full">
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
      <MapContainer center={initialCenter} zoom={13} className="w-full h-full">
        {/* Carto Voyager: gives water (soft blue), parks (sage), and street
            hierarchy out of the box. Labels-under variant keeps streets/place
            names but de-emphasizes them so pins still dominate. */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={19}
        />
        {visiblePermits.map((p, i) => (
          <PermitMarker
            key={`${p.permit_number}-${i}`}
            permit={p}
            onSelect={openPermitPanel}
          />
        ))}
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
    </div>
  )
}
