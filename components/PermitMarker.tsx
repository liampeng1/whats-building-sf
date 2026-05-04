'use client'
import { Marker, Popup } from 'react-leaflet'
import { divIcon } from 'leaflet'
import { useRouter } from 'next/navigation'
import { useMemo } from 'react'
import type { Permit } from '@/lib/types'
import {
  permitStage,
  timeAgo,
  STAGE_COLORS,
  STAGE_LABELS,
  STAGE_SYMBOLS,
  type PermitStage,
} from '@/lib/permit-style'

function shortDate(s: string | null): string | null {
  if (!s) return null
  const d = new Date(s)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

const SYMBOL_PIXEL_SIZE: Record<PermitStage, number> = {
  construction: 28,
  approved: 22,
  filed: 22,
  complete: 20,
  inactive: 18,
}

function buildSymbolIcon(stage: PermitStage) {
  const size = SYMBOL_PIXEL_SIZE[stage]
  const color = STAGE_COLORS[stage].fill
  const symbol = STAGE_SYMBOLS[stage]
  return divIcon({
    className: '',
    html: `<div class="permit-symbol permit-symbol-${stage}" style="color:${color}">${symbol}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  })
}

export function PermitMarker({ permit }: { permit: Permit }) {
  const router = useRouter()
  const stage = permitStage(permit.status)
  const icon = useMemo(() => buildSymbolIcon(stage), [stage])

  if (!permit.location) return null
  const [lng, lat] = permit.location.coordinates
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  const stageColor = STAGE_COLORS[stage].fill
  const issuedShort = shortDate(permit.issued_date)
  const issuedAgo = timeAgo(permit.issued_date)
  const completedShort = shortDate(permit.completed_date)

  return (
    <Marker
      position={[lat, lng]}
      icon={icon}
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
    </Marker>
  )
}
