import { eligibleLaws, permitLawHeuristic } from '../lib/family-zoning'
import type { Permit } from '../lib/types'

describe('eligibleLaws', () => {
  it('flags SB-9 only for RH-1', () => {
    const laws = eligibleLaws('RH-1', 'Residential').map((l) => l.law)
    expect(laws).toContain('SB-9')
    expect(eligibleLaws('RH-2', 'Residential').map((l) => l.law)).not.toContain('SB-9')
  })

  it('flags ADU for any Residential', () => {
    expect(eligibleLaws('RH-3', 'Residential').map((l) => l.law)).toContain('ADU')
    expect(eligibleLaws('RM-2', 'Residential').map((l) => l.law)).toContain('ADU')
  })

  it('flags AB-2011 only for Commercial / Mixed Use', () => {
    expect(eligibleLaws('C-3-O', 'Commercial').map((l) => l.law)).toContain('AB-2011')
    expect(eligibleLaws('NCT-3', 'Mixed Use').map((l) => l.law)).toContain('AB-2011')
    expect(eligibleLaws('RH-1', 'Residential').map((l) => l.law)).not.toContain('AB-2011')
  })

  it('always flags SB-35 in residential / mixed use (SF is below RHNA)', () => {
    expect(eligibleLaws('RH-1', 'Residential').map((l) => l.law)).toContain('SB-35')
    expect(eligibleLaws('NCT-3', 'Mixed Use').map((l) => l.law)).toContain('SB-35')
    expect(eligibleLaws('PDR-1-G', 'Industrial').map((l) => l.law)).not.toContain('SB-35')
  })

  it('flags density bonus for residential / mixed use', () => {
    expect(eligibleLaws('RH-1', 'Residential').map((l) => l.law)).toContain('density-bonus')
    expect(eligibleLaws('NCT-3', 'Mixed Use').map((l) => l.law)).toContain('density-bonus')
  })

  it('every eligibility entry carries a description and a source URL', () => {
    const laws = eligibleLaws('RH-1', 'Residential')
    for (const l of laws) {
      expect(l.description.length).toBeGreaterThan(40)
      expect(l.source.url).toMatch(/^https?:\/\//)
      expect(l.source.cite).toBeTruthy()
    }
  })
})

describe('permitLawHeuristic', () => {
  const base = {
    permit_number: 'TEST',
    location: { type: 'Point' as const, coordinates: [-122.4, 37.7] as [number, number] },
    existing_units: 1,
    proposed_units: 2,
    proposed_use: 'single family dwelling',
    existing_use: 'single family dwelling',
    status: 'filed',
  } as unknown as Permit

  it('flags SB-9 likely when RH-1 + 1->2 units', () => {
    const out = permitLawHeuristic(base, 'RH-1')
    expect(out.find((x) => x.law === 'SB-9')?.confidence).toBe('likely')
  })

  it('flags ADU likely when proposed_use mentions ADU', () => {
    const p = { ...base, proposed_use: 'accessory dwelling unit' } as Permit
    const out = permitLawHeuristic(p, 'RH-1')
    expect(out.find((x) => x.law === 'ADU')?.confidence).toBe('likely')
  })

  it('returns possible (not likely) for eligible but unsignaled laws', () => {
    const out = permitLawHeuristic(base, 'RH-1')
    expect(out.find((x) => x.law === 'SB-35')?.confidence).toBe('possible')
  })

  it('returns [] when zoningSim is null', () => {
    expect(permitLawHeuristic(base, null)).toEqual([])
  })

  it('flags AB-2011 likely for commercial + new residential units', () => {
    const p = { ...base, proposed_use: 'mixed-use residential and retail', existing_units: '0', proposed_units: '12' } as Permit
    const out = permitLawHeuristic(p, 'C-3-O')
    expect(out.find((x) => x.law === 'AB-2011')?.confidence).toBe('likely')
  })
})
