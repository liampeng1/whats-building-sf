import type { Permit } from './types'

export type PermitTypeId = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
export type PermitStage = 'filed' | 'active' | 'complete' | 'inactive'

export interface PermitStyle {
  fillColor: string
  color: string
  weight: number
  fillOpacity: number
  radius: number
}

export const PERMIT_TYPE_IDS: PermitTypeId[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

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

export function permitTypeId(permitType: string): PermitTypeId {
  return (PERMIT_TYPE_IDS as string[]).includes(permitType) ? (permitType as PermitTypeId) : '9'
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
  const id = permitTypeId(permit.permit_type)
  const stage = permitStage(permit.status)
  const colors = PERMIT_TYPE_COLORS[id]

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
