import {
  permitTypeId,
  permitStage,
  permitStyle,
  PERMIT_TYPE_IDS,
  PERMIT_TYPE_COLORS,
  PERMIT_TYPE_LABELS,
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

describe('PERMIT_TYPE_COLORS / LABELS coverage', () => {
  test('every type id has a label and a color pair', () => {
    for (const id of PERMIT_TYPE_IDS) {
      expect(PERMIT_TYPE_LABELS[id]).toBeTruthy()
      expect(PERMIT_TYPE_COLORS[id].fill).toMatch(/^#[0-9a-f]{6}$/i)
      expect(PERMIT_TYPE_COLORS[id].stroke).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  test('all 9 fill colors are distinct', () => {
    const fills = PERMIT_TYPE_IDS.map((id) => PERMIT_TYPE_COLORS[id].fill)
    expect(new Set(fills).size).toBe(fills.length)
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
  location: null,
}

describe('permitStyle', () => {
  test('uses the type-specific color (active type 1)', () => {
    const s = permitStyle({ ...basePermit, permit_type: '1', status: 'issued' })
    expect(s.fillColor).toBe(PERMIT_TYPE_COLORS['1'].fill)
    expect(s.fillOpacity).toBe(0.8)
  })

  test('filed permit is hollow ring (fillOpacity 0, weight > 1)', () => {
    const s = permitStyle({ ...basePermit, permit_type: '8', status: 'filing' })
    expect(s.fillOpacity).toBe(0)
    expect(s.weight).toBeGreaterThan(1)
  })

  test('complete permit is small dark dot', () => {
    const s = permitStyle({ ...basePermit, status: 'complete' })
    expect(s.radius).toBeLessThan(6)
    expect(s.fillOpacity).toBe(1)
  })

  test('inactive permit is faded', () => {
    const s = permitStyle({ ...basePermit, status: 'cancelled' })
    expect(s.fillOpacity).toBeLessThan(0.3)
  })

  test('unknown permit type falls back to type 9 color', () => {
    const s = permitStyle({ ...basePermit, permit_type: '999', status: 'issued' })
    expect(s.fillColor).toBe(PERMIT_TYPE_COLORS['9'].fill)
  })
})
