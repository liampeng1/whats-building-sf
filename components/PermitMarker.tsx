'use client'
import { Marker, Popup } from 'react-leaflet'
import { divIcon } from 'leaflet'
import { useMemo } from 'react'
import type { Permit } from '@/lib/types'
import {
  permitStage,
  timeAgo,
  stageIconSvg,
  STAGE_COLORS,
  STAGE_LABELS,
  type PermitStage,
} from '@/lib/permit-style'

function shortDate(s: string | null): string | null {
  if (!s) return null
  const d = new Date(s)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

const PIN_PIXEL_SIZE: Record<PermitStage, number> = {
  construction: 30,
  permitted: 26,
  approved: 24,
  filed: 22,
  complete: 22,
  inactive: 20,
}

function buildIcon(stage: PermitStage) {
  const size = PIN_PIXEL_SIZE[stage]
  const svg = stageIconSvg(stage, size)
  return divIcon({
    className: '',
    html: `<div class="permit-pin permit-pin-${stage}">${svg}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  })
}

interface MarkerProps {
  permit: Permit
  onSelect?: (permitNumber: string) => void
}

export function PermitMarker({ permit, onSelect }: MarkerProps) {
  const stage = permitStage(permit)
  const icon = useMemo(() => buildIcon(stage), [stage])

  if (!permit.location) return null
  const [lng, lat] = permit.location.coordinates
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  const stageColor = STAGE_COLORS[stage].fill
  const issuedShort = shortDate(permit.issued_date)
  const issuedAgo = timeAgo(permit.issued_date)
  const completedShort = shortDate(permit.completed_date)
  const popupIcon = stageIconSvg(stage, 16)

  return (
    <Marker
      position={[lat, lng]}
      icon={icon}
      eventHandlers={{
        click: () => {
          if (onSelect) onSelect(permit.permit_number)
        },
      }}
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
        <span style={{ color: stageColor, fontWeight: 600, fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span dangerouslySetInnerHTML={{ __html: popupIcon }} style={{ display: 'inline-flex' }} />
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
