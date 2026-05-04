'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { MapContainer, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { PermitMarker } from './PermitMarker'
import { MapEventHandler } from './MapEventHandler'
import { MapLegend } from './MapLegend'
import type { Permit, MapBounds } from '@/lib/types'

interface Props {
  initialCenter?: [number, number]
}

export default function Map({ initialCenter = [37.7749, -122.4194] }: Props) {
  const [permits, setPermits] = useState<Permit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchData = useCallback(async (bounds?: MapBounds) => {
    setLoading(true)
    setError(null)
    const q = bounds
      ? `?north=${bounds.north}&south=${bounds.south}&east=${bounds.east}&west=${bounds.west}`
      : ''
    try {
      const res = await fetch(`/api/permits${q}`)
      if (!res.ok) throw new Error('fetch failed')
      const data: Permit[] = await res.json()
      setPermits(data)
    } catch {
      setError('Data temporarily unavailable. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleBoundsChange = useCallback((bounds: MapBounds) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchData(bounds), 300)
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
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapEventHandler onBoundsChange={handleBoundsChange} />
        {permits.map((p, i) => <PermitMarker key={`${p.permit_number}-${i}`} permit={p} />)}
      </MapContainer>
      <MapLegend />
    </div>
  )
}
