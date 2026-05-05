'use client'
import { Marker, Tooltip } from 'react-leaflet'
import { divIcon } from 'leaflet'
import { memo, useMemo } from 'react'
import type { Permit } from '@/lib/types'
import {
  permitStage,
  stageIconSvg,
  netDelta,
  STAGE_COLORS,
  STAGE_LABELS,
  type PermitStage,
} from '@/lib/permit-style'

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

function PermitMarkerImpl({ permit, onSelect }: MarkerProps) {
  const stage = permitStage(permit)
  const icon = useMemo(() => buildIcon(stage), [stage])

  if (!permit.location) return null
  const [lng, lat] = permit.location.coordinates
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  const stageColor = STAGE_COLORS[stage].fill
  const stageLabel = STAGE_LABELS[stage].split(' / ')[0].split(' · ')[0]
  const homes = netDelta(permit.existing_units, permit.proposed_units)

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
      <Tooltip
        direction="top"
        offset={[0, -PIN_PIXEL_SIZE[stage] / 2]}
        opacity={1}
        className="permit-tooltip"
      >
        <div style={{ fontFamily: 'var(--font-source-serif), Georgia, serif', fontSize: '0.9rem', fontWeight: 600, color: '#1c2438', lineHeight: 1.2 }}>
          {permit.address}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: stageColor, fontWeight: 600 }}>
          <span style={{ display: 'inline-flex', width: 12, height: 12 }} dangerouslySetInnerHTML={{ __html: stageIconSvg(stage, 12) }} />
          {stageLabel}
          {homes != null && homes > 0 && (
            <span style={{ color: '#78716c', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>
              · +{homes} home{homes === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </Tooltip>
    </Marker>
  )
}

// Memoize so unchanged markers don't re-render when the parent's
// visiblePermits set changes (e.g. on filter toggle or pan). Permit objects
// are stable references within a fetch batch, so default shallow compare
// works.
export const PermitMarker = memo(PermitMarkerImpl)
