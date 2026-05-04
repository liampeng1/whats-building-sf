import type { Permit } from './types'

export type PermitCategory = 'new' | 'alteration' | 'demolition' | 'sign' | 'other'
export type PermitStage = 'filed' | 'active' | 'complete' | 'inactive'

export interface PermitStyle {
  fillColor: string
  color: string
  weight: number
  fillOpacity: number
  radius: number
}

export const CATEGORY_LABELS: Record<PermitCategory, string> = {
  new: 'New construction',
  alteration: 'Alterations / repairs',
  demolition: 'Demolition',
  sign: 'Signs',
  other: 'Other',
}

export const CATEGORY_COLORS: Record<PermitCategory, { fill: string; stroke: string }> = {
  new: { fill: '#16a34a', stroke: '#14532d' },
  alteration: { fill: '#2563eb', stroke: '#1e3a8a' },
  demolition: { fill: '#dc2626', stroke: '#7f1d1d' },
  sign: { fill: '#d97706', stroke: '#78350f' },
  other: { fill: '#64748b', stroke: '#1e293b' },
}

export const STAGE_LABELS: Record<PermitStage, string> = {
  filed: 'Filed / under review',
  active: 'Approved / issued',
  complete: 'Complete',
  inactive: 'Inactive',
}

export function permitCategory(permitType: string): PermitCategory {
  switch (permitType) {
    case '1':
    case '2':
      return 'new'
    case '3':
    case '8':
      return 'alteration'
    case '6':
      return 'demolition'
    case '4':
    case '7':
      return 'sign'
    default:
      return 'other'
  }
}

export function permitStage(status: string): PermitStage {
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

export function permitStyle(permit: Permit): PermitStyle {
  const category = permitCategory(permit.permit_type)
  const stage = permitStage(permit.status)
  const colors = CATEGORY_COLORS[category]

  switch (stage) {
    case 'filed':
      return { fillColor: colors.fill, color: colors.stroke, weight: 2, fillOpacity: 0, radius: 6 }
    case 'active':
      return { fillColor: colors.fill, color: colors.stroke, weight: 1, fillOpacity: 0.8, radius: 6 }
    case 'complete':
      return { fillColor: colors.stroke, color: colors.stroke, weight: 1, fillOpacity: 1, radius: 4 }
    case 'inactive':
      return { fillColor: colors.fill, color: colors.stroke, weight: 1, fillOpacity: 0.15, radius: 5 }
  }
}
