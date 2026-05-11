'use client'
import { LensInfoPanel } from './LensInfoPanel'
import { getZoningRecord } from '@/lib/zoning-rules'
import { eligibleLaws } from '@/lib/family-zoning'

interface Props {
  zoningSim: string | null
  gen: string | null
  heightFt?: number
  bulk?: string
  onClose: () => void
}

export function ZoningDistrictPanel({ zoningSim, gen, heightFt, bulk, onClose }: Props) {
  const open = !!zoningSim
  const rec = zoningSim ? getZoningRecord(zoningSim) : null
  const laws = zoningSim && gen ? eligibleLaws(zoningSim, gen) : []

  if (!zoningSim) {
    return (
      <LensInfoPanel
        open={open}
        eyebrow="Zoning district"
        title="—"
        primary={{ eyebrow: 'Rules', rows: [] }}
        onClose={onClose}
      />
    )
  }

  if (!rec) {
    // Polygon clicked but no record in the lookup. Shouldn't happen at
    // runtime (build asserts coverage), but degrade gracefully if it does.
    return (
      <LensInfoPanel
        open={open}
        eyebrow="Zoning district"
        title={zoningSim}
        subtitle={gen ?? undefined}
        hero={
          heightFt
            ? { eyebrow: 'Max height', value: `${heightFt} ft`, detail: bulk ? `bulk ${bulk}` : '' }
            : undefined
        }
        primary={{ eyebrow: 'Rules', rows: [] }}
        onClose={onClose}
      />
    )
  }

  // Rule rows — only include fields with usable values; otherwise the row
  // would just print "undefined".
  const ruleRows: { label: string; value: string; pct: number; color: string }[] = []
  if (heightFt) {
    ruleRows.push({
      label: `Height: ${heightFt} ft${bulk ? ` (bulk ${bulk})` : ''}`,
      value: '',
      pct: 1,
      color: '#7d9b76',
    })
  }
  if (rec.density.units_per_lot != null) {
    ruleRows.push({
      label: `Density: ${rec.density.units_per_lot} unit(s) per lot`,
      value: '',
      pct: 1,
      color: '#7d9b76',
    })
  } else if (rec.density.du_per_acre != null) {
    ruleRows.push({
      label: `Density: ${rec.density.du_per_acre} DU/acre`,
      value: '',
      pct: 1,
      color: '#7d9b76',
    })
  } else if (rec.density.note) {
    ruleRows.push({
      label: `Density: ${rec.density.note}`,
      value: '',
      pct: 0.5,
      color: '#7d9b76',
    })
  }
  if (rec.far?.max) {
    ruleRows.push({
      label: `FAR cap: ${rec.far.max}`,
      value: '',
      pct: 1,
      color: '#7d9b76',
    })
  }
  if (rec.parking_min.residential) {
    ruleRows.push({
      label: `Parking (resi): ${rec.parking_min.residential}`,
      value: '',
      pct: 0.7,
      color: '#b08968',
    })
  }
  if (rec.parking_min.commercial) {
    ruleRows.push({
      label: `Parking (commercial): ${rec.parking_min.commercial}`,
      value: '',
      pct: 0.7,
      color: '#b08968',
    })
  }
  if (rec.principal_uses.length > 0) {
    ruleRows.push({
      label: `Uses: ${rec.principal_uses.slice(0, 3).join(', ')}${rec.principal_uses.length > 3 ? '…' : ''}`,
      value: '',
      pct: 0.6,
      color: '#5d7a99',
    })
  }

  const lawRows = laws.map((l) => ({
    label: `${l.law}: ${l.uplift_summary}`,
    value: '',
    pct: 1,
    color: '#9a4a31',
  }))

  return (
    <LensInfoPanel
      open={open}
      eyebrow="Zoning district"
      title={zoningSim}
      subtitle={gen ?? undefined}
      hero={
        heightFt
          ? { eyebrow: 'Max height', value: `${heightFt} ft`, detail: bulk ? `bulk ${bulk}` : '' }
          : undefined
      }
      primary={{ eyebrow: 'Rules', rows: ruleRows }}
      secondary={lawRows.length > 0 ? { eyebrow: 'State-law uplift', rows: lawRows } : undefined}
      onClose={onClose}
    />
  )
}
