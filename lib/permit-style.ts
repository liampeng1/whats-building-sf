import type { Permit } from './types'

export type PermitTypeId = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
export type PermitStage = 'filed' | 'active' | 'complete' | 'inactive'

// Single accent color (emerald) for all tracked permits — they're all major
// new construction now. Stage hierarchy is conveyed by size + style instead.
export const ACCENT = { fill: '#10b981', stroke: '#064e3b' } as const

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
  active: 'Approved / issued',
  complete: 'Complete',
  inactive: 'Inactive',
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
  if (
    s === 'approved' ||
    s === 'issued' ||
    s === 'issuing' ||
    s === 'granted' ||
    s === 'reinstated' ||
    s === 'inspection' ||
    s === 'upheld'
  ) {
    return 'active'
  }
  return 'filed'
}

export function isUnderConstruction(permit: Permit): boolean {
  const s = (permit.status ?? '').toLowerCase()
  if (s === 'inspection') return true
  // Issued but not yet completed = work either underway or imminent.
  return permit.issued_date != null && permit.completed_date == null && permitStage(s) === 'active'
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

  switch (stage) {
    case 'active':
      // Largest, most prominent: filled circle with white halo so it pops on any base.
      return { fillColor: ACCENT.fill, color: '#ffffff', weight: 2, fillOpacity: 0.95, radius: 9 }
    case 'filed':
      // White-filled with thick colored stroke — reads as a "ring".
      return { fillColor: '#ffffff', color: ACCENT.stroke, weight: 2.5, fillOpacity: 0.9, radius: 6 }
    case 'complete':
      // Smallest, dark dot — recedes visually but stays scannable.
      return { fillColor: ACCENT.stroke, color: '#ffffff', weight: 1.5, fillOpacity: 1, radius: 4 }
    case 'inactive':
      // Faded, low-attention.
      return { fillColor: ACCENT.fill, color: ACCENT.stroke, weight: 1, fillOpacity: 0.2, radius: 5 }
  }
}
