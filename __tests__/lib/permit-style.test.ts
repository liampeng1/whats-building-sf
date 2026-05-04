import {
  permitTypeId,
  permitStage,
  permitStyle,
  ACCENT,
  PERMIT_TYPE_IDS,
} from '@/lib/permit-style'
import type { Permit } from '@/lib/types'

describe('permitTypeId', () => {
  test('returns the same id for known types 1-9', () => {
    for (const id of PERMIT_TYPE_IDS) {
      expect(permitTypeId(id)).toBe(id)
    }
  })

  test('falls back to "9" for unknown types', () => {
    expect(permitTypeId('99')).toBe('9')
    expect(permitTypeId('')).toBe('9')
    expect(permitTypeId('unexpected')).toBe('9')
  })
})

describe('permitStage', () => {
  test('classifies issued/approved/inspection as active', () => {
    expect(permitStage('issued')).toBe('active')
    expect(permitStage('approved')).toBe('active')
    expect(permitStage('inspection')).toBe('active')
  })

  test('classifies complete as complete', () => {
    expect(permitStage('complete')).toBe('complete')
  })

  test('classifies cancelled/expired/withdrawn as inactive', () => {
    expect(permitStage('cancelled')).toBe('inactive')
    expect(permitStage('expired')).toBe('inactive')
    expect(permitStage('withdrawn')).toBe('inactive')
  })

  test('classifies filing/triage/plancheck as filed', () => {
    expect(permitStage('filing')).toBe('filed')
    expect(permitStage('filed')).toBe('filed')
    expect(permitStage('triage')).toBe('filed')
    expect(permitStage('plancheck')).toBe('filed')
  })

  test('handles uppercase status', () => {
    expect(permitStage('ISSUED')).toBe('active')
  })
})

const basePermit: Permit = {
  permit_number: 'X',
  permit_type: '1',
  permit_type_definition: 'new construction',
  status: 'issued',
  description: null,
  address: 'A',
  filed_date: null,
  issued_date: null,
  completed_date: null,
  status_date: null,
  estimated_cost: null,
  location: null,
}

describe('permitStyle', () => {
  test('active permit is largest with white halo and accent fill', () => {
    const s = permitStyle({ ...basePermit, status: 'issued' })
    expect(s.fillColor).toBe(ACCENT.fill)
    expect(s.color).toBe('#ffffff')
    expect(s.radius).toBe(9)
  })

  test('filed permit reads as a ring (white fill, thick accent stroke)', () => {
    const s = permitStyle({ ...basePermit, status: 'filing' })
    expect(s.fillColor).toBe('#ffffff')
    expect(s.color).toBe(ACCENT.stroke)
    expect(s.weight).toBeGreaterThanOrEqual(2)
  })

  test('complete permit is small dark dot', () => {
    const s = permitStyle({ ...basePermit, status: 'complete' })
    expect(s.fillColor).toBe(ACCENT.stroke)
    expect(s.radius).toBe(4)
    expect(s.fillOpacity).toBe(1)
  })

  test('inactive permit is faded', () => {
    const s = permitStyle({ ...basePermit, status: 'cancelled' })
    expect(s.fillOpacity).toBeLessThan(0.3)
  })

  test('all stages use the same accent fill family (single category)', () => {
    const active = permitStyle({ ...basePermit, status: 'issued' })
    const inactive = permitStyle({ ...basePermit, status: 'cancelled' })
    expect(active.fillColor).toBe(ACCENT.fill)
    expect(inactive.fillColor).toBe(ACCENT.fill)
  })
})
