import {
  permitTypeId,
  permitStage,
  permitStyle,
  useCategory,
  netDelta,
  STAGE_COLORS,
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
  test('issued / issuing / inspection / reinstated read as permitted (pre-build) by default', () => {
    expect(permitStage('issued')).toBe('permitted')
    expect(permitStage('issuing')).toBe('permitted')
    expect(permitStage('inspection')).toBe('permitted')
    expect(permitStage('reinstated')).toBe('permitted')
  })

  test('approved / granted / upheld are pre-issuance "approved" stage', () => {
    expect(permitStage('approved')).toBe('approved')
    expect(permitStage('granted')).toBe('approved')
    expect(permitStage('upheld')).toBe('approved')
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
    expect(permitStage('ISSUED')).toBe('permitted')
    expect(permitStage('APPROVED')).toBe('approved')
  })

  test('pipeline_status="Construction" overrides raw status when given a Permit', () => {
    // Raw status maps to 'filed' but pipeline says construction → wins.
    const p = { ...basePermit, status: 'filing', pipeline_status: 'Construction' }
    expect(permitStage(p)).toBe('construction')
  })

  test('Permit without pipeline_status falls through to raw status mapping', () => {
    expect(permitStage({ ...basePermit, status: 'issued' })).toBe('permitted')
    expect(permitStage({ ...basePermit, status: 'approved' })).toBe('approved')
  })

  test('pipeline BP Issued maps to permitted (issued, not yet building)', () => {
    expect(
      permitStage({ ...basePermit, status: 'issued', pipeline_status: 'BP Issued' }),
    ).toBe('permitted')
  })

  test('pipeline Construction overrides even when raw status is issued', () => {
    expect(
      permitStage({ ...basePermit, status: 'issued', pipeline_status: 'Construction' }),
    ).toBe('construction')
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
  existing_use: null,
  proposed_use: null,
  existing_units: null,
  proposed_units: null,
  existing_stories: null,
  proposed_stories: null,
  pipeline_status: null,
  pipeline_status_date: null,
  block: null,
  lot: null,
  location: null,
}

describe('permitStyle', () => {
  test('under-construction permit is the loudest (largest, halo)', () => {
    // Construction stage now requires pipeline_status='Construction' confirmation.
    const construction = permitStyle({ ...basePermit, pipeline_status: 'Construction' })
    const approved = permitStyle({ ...basePermit, status: 'approved' })
    expect(construction.fillColor).toBe(STAGE_COLORS.construction.fill)
    expect(construction.color).toBe('#ffffff')
    expect(construction.radius).toBeGreaterThan(approved.radius)
  })

  test('approved permit uses warm amber', () => {
    const s = permitStyle({ ...basePermit, status: 'approved' })
    expect(s.fillColor).toBe(STAGE_COLORS.approved.fill)
    expect(s.radius).toBe(7)
  })

  test('issued (no pipeline data) maps to permitted, not construction', () => {
    const s = permitStyle({ ...basePermit, status: 'issued' })
    expect(s.fillColor).toBe(STAGE_COLORS.permitted.fill)
  })

  test('filed permit reads as a paper-filled ring with cool slate stroke', () => {
    const s = permitStyle({ ...basePermit, status: 'filing' })
    expect(s.color).toBe(STAGE_COLORS.filed.stroke)
    expect(s.weight).toBeGreaterThanOrEqual(2)
  })

  test('complete permit uses settled forest green', () => {
    const s = permitStyle({ ...basePermit, status: 'complete' })
    expect(s.fillColor).toBe(STAGE_COLORS.complete.fill)
    expect(s.radius).toBe(4)
    expect(s.fillOpacity).toBe(1)
  })

  test('inactive permit is faded taupe', () => {
    const s = permitStyle({ ...basePermit, status: 'cancelled' })
    expect(s.fillColor).toBe(STAGE_COLORS.inactive.fill)
    expect(s.fillOpacity).toBeLessThan(0.3)
  })
})

describe('useCategory', () => {
  test('classifies dwelling / apartments as housing', () => {
    expect(useCategory('1 family dwelling')).toBe('housing')
    expect(useCategory('apartments')).toBe('housing')
  })

  test('classifies hotels / motels as housing (SF infill heuristic)', () => {
    expect(useCategory('tourist hotel/motel')).toBe('housing')
    expect(useCategory('motel')).toBe('housing')
    expect(useCategory('misc group residns.')).toBe('housing')
  })

  test('classifies retail / restaurant as retail', () => {
    expect(useCategory('retail sales')).toBe('retail')
    expect(useCategory('restaurant')).toBe('retail')
  })

  test('falls back to other for empty / unknown uses', () => {
    expect(useCategory(null)).toBe('other')
    expect(useCategory('')).toBe('other')
    expect(useCategory('parking lot')).toBe('other')
  })
})

describe('netDelta', () => {
  test('returns positive delta when proposed > existing', () => {
    expect(netDelta('1', '12')).toBe(11)
  })

  test('returns negative delta when proposed < existing', () => {
    expect(netDelta('5', '2')).toBe(-3)
  })

  test('treats missing existing as 0', () => {
    expect(netDelta(null, '8')).toBe(8)
  })

  test('returns null when both sides are missing', () => {
    expect(netDelta(null, null)).toBeNull()
  })

  test('returns null on non-numeric input', () => {
    expect(netDelta('abc', '5')).toBeNull()
  })
})
