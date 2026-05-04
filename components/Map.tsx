'use client'
import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { MapContainer, TileLayer } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import 'leaflet/dist/leaflet.css'
import './marker-cluster.css'
import { PermitMarker } from './PermitMarker'
import { MapEventHandler } from './MapEventHandler'
import { FilterPanel } from './FilterPanel'
import { permitStage, STAGE_ORDER, type PermitStage } from '@/lib/permit-style'
import type { Permit, MapBounds } from '@/lib/types'

const ALL_STAGES: PermitStage[] = STAGE_ORDER

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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const toggleStage = useCallback((stage: PermitStage) => {
    setSelectedStages((prev) => {
      const next = new Set(prev)
      if (next.has(stage)) next.delete(stage)
      else next.add(stage)
      return next
    })
  }, [])

  const visiblePermits = useMemo(
    () => permits.filter((p) => selectedStages.has(permitStage(p.status))),
    [permits, selectedStages],
  )

  const fetchData = useCallback(async (bounds: MapBounds | undefined, signal?: AbortSignal) => {
    const q = bounds
      ? `?north=${bounds.north}&south=${bounds.south}&east=${bounds.east}&west=${bounds.west}`
      : ''
    try {
      const res = await fetch(`/api/permits${q}`, { signal })
      if (!res.ok) throw new Error('fetch failed')
      const data: Permit[] = await res.json()
      if (signal?.aborted) return
      setPermits(data)
      setError(null)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError('Data temporarily unavailable. Please try again.')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const ctrl = new AbortController()
    // setState calls inside fetchData run after the awaited fetch (microtask),
    // not synchronously. The rule's static analysis can't see through async/await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData(undefined, ctrl.signal)
    return () => ctrl.abort()
  }, [fetchData])

  const handleBoundsChange = useCallback((bounds: MapBounds) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setLoading(true)
      fetchData(bounds)
    }, 300)
  }, [fetchData])

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
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={19}
        />
        <MapEventHandler onBoundsChange={handleBoundsChange} />
        <MarkerClusterGroup
          chunkedLoading
          showCoverageOnHover={false}
          spiderfyOnMaxZoom
          disableClusteringAtZoom={16}
          maxClusterRadius={50}
        >
          {visiblePermits.map((p, i) => (
            <PermitMarker key={`${p.permit_number}-${i}`} permit={p} />
          ))}
        </MarkerClusterGroup>
      </MapContainer>
      <FilterPanel selectedStages={selectedStages} onToggleStage={toggleStage} />
    </div>
  )
}
