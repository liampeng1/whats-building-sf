import type { Permit } from './types'

export type PermitTypeId = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
// Lifecycle stages in order. 'inactive' is off-track (cancelled/expired/denied).
export type PermitStage = 'filed' | 'approved' | 'construction' | 'complete' | 'inactive'

// Order they appear in the timeline / legend.
export const STAGE_ORDER: PermitStage[] = ['filed', 'approved', 'construction', 'complete', 'inactive']

// Lifecycle palette — slate (paperwork) → light green (approved/go) → hazard
// orange-and-black (construction = active danger) → forest green (settled).
export const STAGE_COLORS = {
  filed:        { fill: '#334155', stroke: '#1e293b' },  // slate
  approved:     { fill: '#65a30d', stroke: '#365314' },  // lime / light green
  construction: { fill: '#ea580c', stroke: '#000000' },  // hazard orange + black
  complete:     { fill: '#166534', stroke: '#14532d' },  // forest green
  inactive:     { fill: '#a8a29e', stroke: '#57534e' },  // taupe
} as const

export interface PermitStyle {
  fillColor: string
  color: string
  weight: number
  fillOpacity: number
  radius: number
}

export const PERMIT_TYPE_IDS: PermitTypeId[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
export const TRACKED_PERMIT_TYPE_IDS: PermitTypeId[] = ['1', '2', '3']

export const PERMIT_TYPE_LABELS: Record<PermitTypeId, string> = {
  '1': 'New construction',
  '2': 'New construction (wood frame)',
  '3': 'Additions / alterations / repairs',
  '4': 'Sign — erect',
  '5': 'Grade / quarry / fill / excavate',
  '6': 'Demolition',
  '7': 'Wall or painted sign',
  '8': 'OTC alterations',
  '9': 'Other',
}

export const PERMIT_TYPE_COLORS: Record<PermitTypeId, { fill: string; stroke: string }> = {
  '1': { fill: '#10b981', stroke: '#064e3b' },
  '2': { fill: '#65a30d', stroke: '#365314' },
  '3': { fill: '#2563eb', stroke: '#1e3a8a' },
  '4': { fill: '#d97706', stroke: '#78350f' },
  '5': { fill: '#78716c', stroke: '#292524' },
  '6': { fill: '#dc2626', stroke: '#7f1d1d' },
  '7': { fill: '#ea580c', stroke: '#7c2d12' },
  '8': { fill: '#0ea5e9', stroke: '#0c4a6e' },
  '9': { fill: '#64748b', stroke: '#1e293b' },
}

export const STAGE_LABELS: Record<PermitStage, string> = {
  filed: 'Filed / under review',
  approved: 'Approved / issued',
  construction: 'Under construction',
  complete: 'Complete',
  inactive: 'Inactive / cancelled',
}

// Pictographic SVG icons per stage. Returns a complete SVG string sized to fit
// inside a `size`x`size` box. The fill/stroke uses the stage's color.
//
// filed       = paper / document outline
// approved    = paper with checkmark (signed off)
// construction = warning triangle with exclamation (road-sign / barricade)
// complete    = filled circle with white check
// inactive    = circle with diagonal slash
export function stageIconSvg(stage: PermitStage, size: number = 24): string {
  const c = STAGE_COLORS[stage].fill
  const dims = `width="${size}" height="${size}" viewBox="0 0 24 24"`
  switch (stage) {
    case 'filed':
      return `<svg ${dims} fill="${c}19" stroke="${c}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8" fill="none"/>
        <line x1="8" y1="13" x2="16" y2="13"/>
        <line x1="8" y1="17" x2="14" y2="17"/>
      </svg>`
    case 'approved':
      return `<svg ${dims} fill="${c}19" stroke="${c}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8" fill="none"/>
        <polyline points="8.5 14 11 16.5 16 11.5" fill="none" stroke-width="2"/>
      </svg>`
    case 'construction':
      // Classic hazard sign: orange triangle with black border + black ! mark.
      return `<svg ${dims} fill="${c}" stroke="#000000" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 2.5 1 21.5h22z"/>
        <line x1="12" y1="9" x2="12" y2="14.5" stroke="#000000" stroke-width="2.4" stroke-linecap="round"/>
        <circle cx="12" cy="17.6" r="1.2" fill="#000000" stroke="none"/>
      </svg>`
    case 'complete':
      return `<svg ${dims} fill="${c}" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="7.5 12.5 10.5 15.5 16.5 9.5" fill="none" stroke="#fbf6ec" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`
    case 'inactive':
      return `<svg ${dims} fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9"/>
        <line x1="6" y1="18" x2="18" y2="6"/>
      </svg>`
  }
}

export function permitTypeId(permitType: string | null | undefined): PermitTypeId {
  if (!permitType) return '9'
  return (PERMIT_TYPE_IDS as string[]).includes(permitType) ? (permitType as PermitTypeId) : '9'
}

export function permitStage(status: string | null | undefined): PermitStage {
  if (!status) return 'filed'
  const s = status.toLowerCase()
  if (s === 'complete') return 'complete'
  if (
    s === 'cancelled' ||
    s === 'denied' ||
    s === 'disapproved' ||
    s === 'expired' ||
    s === 'revoked' ||
    s === 'suspend' ||
    s === 'withdrawn' ||
    s === 'overruled' ||
    s === 'unknown'
  ) {
    return 'inactive'
  }
  // Permit issued or under inspection = work either happening or imminent.
  // We treat the entire issuance window as "construction" since that's the
  // colloquial meaning — the building is being built.
  if (s === 'issued' || s === 'issuing' || s === 'inspection' || s === 'reinstated') {
    return 'construction'
  }
  // Approved on paper but not yet issued — closer to filed than to construction.
  if (s === 'approved' || s === 'granted' || s === 'upheld') return 'approved'
  return 'filed'
}

export function isUnderConstruction(permit: Permit): boolean {
  return permitStage(permit.status) === 'construction'
}

export function timeAgo(dateStr: string | null, now: Date = new Date()): string | null {
  if (!dateStr) return null
  const then = new Date(dateStr)
  if (isNaN(then.getTime())) return null
  const diffMs = now.getTime() - then.getTime()
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (days < 0) {
    const future = -days
    if (future < 30) return `in ${future} day${future === 1 ? '' : 's'}`
    const months = Math.round(future / 30)
    return `in ${months} month${months === 1 ? '' : 's'}`
  }
  if (days < 1) return 'today'
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`
  const years = Math.floor(days / 365)
  const remMonths = Math.floor((days - years * 365) / 30)
  if (remMonths === 0) return `${years} year${years === 1 ? '' : 's'} ago`
  return `${years}y ${remMonths}mo ago`
}

export function permitStyle(permit: Permit): PermitStyle {
  const stage = permitStage(permit.status)
  const c = STAGE_COLORS[stage]

  switch (stage) {
    case 'construction':
      // The headline state: largest pin, hot red, thick white halo.
      return { fillColor: c.fill, color: '#ffffff', weight: 3, fillOpacity: 1, radius: 10 }
    case 'approved':
      // Warm amber, medium size — work upcoming.
      return { fillColor: c.fill, color: '#ffffff', weight: 2, fillOpacity: 0.85, radius: 7 }
    case 'filed':
      // Cool slate ring — paperwork phase, low energy.
      return { fillColor: '#fbf6ec', color: c.stroke, weight: 2.5, fillOpacity: 0.9, radius: 6 }
    case 'complete':
      // Settled forest dot.
      return { fillColor: c.fill, color: '#ffffff', weight: 1.5, fillOpacity: 1, radius: 4 }
    case 'inactive':
      // Off-track taupe, faded.
      return { fillColor: c.fill, color: c.stroke, weight: 1, fillOpacity: 0.25, radius: 5 }
  }
}
