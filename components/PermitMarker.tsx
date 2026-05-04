'use client'
import { CircleMarker, Popup } from 'react-leaflet'
import { useRouter } from 'next/navigation'
import type { Permit } from '@/lib/types'
import { permitStyle } from '@/lib/permit-style'

export function PermitMarker({ permit }: { permit: Permit }) {
  const router = useRouter()
  if (!permit.location) return null
  const [lng, lat] = permit.location.coordinates
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  const style = permitStyle(permit)

  return (
    <CircleMarker
      center={[lat, lng]}
      radius={style.radius}
      pathOptions={{
        fillColor: style.fillColor,
        color: style.color,
        weight: style.weight,
        fillOpacity: style.fillOpacity,
      }}
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
