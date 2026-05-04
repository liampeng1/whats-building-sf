import { permitCategory, permitStage, permitStyle } from '@/lib/permit-style'
import type { Permit } from '@/lib/types'

describe('permitCategory', () => {
  test('maps types 1 and 2 to new construction', () => {
    expect(permitCategory('1')).toBe('new')
    expect(permitCategory('2')).toBe('new')
  })

  test('maps types 3 and 8 to alterations', () => {
    expect(permitCategory('3')).toBe('alteration')
    expect(permitCategory('8')).toBe('alteration')
  })

  test('maps type 6 to demolition', () => {
    expect(permitCategory('6')).toBe('demolition')
  })

  test('maps types 4 and 7 to signs', () => {
    expect(permitCategory('4')).toBe('sign')
    expect(permitCategory('7')).toBe('sign')
  })

  test('falls back to other for unknown types', () => {
    expect(permitCategory('5')).toBe('other')
    expect(permitCategory('9')).toBe('other')
    expect(permitCategory('999')).toBe('other')
  })
})

describe('permitStage', () => {
  test('classifies issued/approved as active', () => {
    expect(permitStage('issued')).toBe('active')
    expect(permitStage('approved')).toBe('active')
    expect(permitStage('inspection')).toBe('active')
  })

  test('classifies complete as complete', () => {
    expect(permitStage('complete')).toBe('complete')
  })

  test('classifies cancelled/expired as inactive', () => {
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
  test('active new-construction is filled green', () => {
    const s = permitStyle({ ...basePermit, permit_type: '1', status: 'issued' })
    expect(s.fillColor).toBe('#16a34a')
    expect(s.fillOpacity).toBe(0.8)
  })

  test('filed permit is hollow ring', () => {
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
})
