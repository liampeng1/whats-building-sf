'use client'
import { CircleMarker, Popup } from 'react-leaflet'
import { useRouter } from 'next/navigation'
import type { Permit } from '@/lib/types'

export function PermitMarker({ permit }: { permit: Permit }) {
  const router = useRouter()
  if (!permit.location) return null
  const [lng, lat] = permit.location.coordinates
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  return (
    <CircleMarker
      center={[lat, lng]}
      radius={6}
      pathOptions={{ fillColor: '#3b82f6', color: '#1d4ed8', weight: 1, fillOpacity: 0.8 }}
      eventHandlers={{ click: () => router.push(`/permits/${permit.permit_number}`) }}
    >
      <Popup>
        <strong>{permit.address}</strong>
        <br />
        {permit.permit_type_definition ?? permit.permit_type}
        <br />
        Status: {permit.status}
      </Popup>
    </CircleMarker>
  )
}
