'use client'
import { CircleMarker, Popup } from 'react-leaflet'
import { useRouter } from 'next/navigation'
import type { Permit } from '@/lib/types'
import { permitStyle, permitStage, timeAgo, STAGE_COLORS, STAGE_LABELS, STAGE_SYMBOLS } from '@/lib/permit-style'

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
  const stage = permitStage(permit.status)
  const stageColor = STAGE_COLORS[stage].fill
  const issuedShort = shortDate(permit.issued_date)
  const issuedAgo = timeAgo(permit.issued_date)
  const completedShort = shortDate(permit.completed_date)

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
        <strong style={{ fontFamily: 'var(--font-source-serif), Georgia, serif', fontSize: '1rem', color: '#1c2438' }}>
          {permit.address}
        </strong>
        <br />
        <span style={{ color: '#475569', fontSize: '0.85rem' }}>
          {permit.permit_type_definition ?? permit.permit_type}
        </span>
        <br />
        <span style={{ color: stageColor, fontWeight: 600, fontSize: '0.85rem' }}>
          <span style={{ marginRight: 4 }}>{STAGE_SYMBOLS[stage]}</span>
          {stage === 'complete' && completedShort
            ? `Completed ${completedShort}`
            : STAGE_LABELS[stage]}
        </span>
        {issuedShort && stage !== 'complete' && (
          <>
            <br />
            <span style={{ color: '#78716c', fontSize: '0.78rem' }}>
              Issued {issuedShort}{issuedAgo ? ` · ${issuedAgo}` : ''}
            </span>
          </>
        )}
      </Popup>
    </CircleMarker>
  )
}
