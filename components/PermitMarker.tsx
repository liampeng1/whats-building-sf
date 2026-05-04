'use client'
import { CircleMarker, Popup } from 'react-leaflet'
import { useRouter } from 'next/navigation'
import type { Permit } from '@/lib/types'
import { permitStyle, isUnderConstruction, timeAgo } from '@/lib/permit-style'

function shortDate(s: string | null): string | null {
  if (!s) return null
  const d = new Date(s)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export function PermitMarker({ permit }: { permit: Permit }) {
  const router = useRouter()
  if (!permit.location) return null
  const [lng, lat] = permit.location.coordinates
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  const style = permitStyle(permit)
  const underConstruction = isUnderConstruction(permit)
  const completedShort = shortDate(permit.completed_date)
  const issuedShort = shortDate(permit.issued_date)
  const issuedAgo = timeAgo(permit.issued_date)

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
        {underConstruction && (
          <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-white text-xs" style={{ backgroundColor: '#dc2626' }}>
            🚧 Under construction
          </span>
        )}
        {permit.status === 'complete' && completedShort && (
          <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-white text-xs" style={{ backgroundColor: '#16a34a' }}>
            ✓ Completed {completedShort}
          </span>
        )}
        {!underConstruction && permit.status !== 'complete' && (
          <>Status: {permit.status}</>
        )}
        {issuedShort && (
          <>
            <br />
            <span className="text-gray-600">Issued {issuedShort}{issuedAgo ? ` (${issuedAgo})` : ''}</span>
          </>
        )}
      </Popup>
    </CircleMarker>
  )
}
