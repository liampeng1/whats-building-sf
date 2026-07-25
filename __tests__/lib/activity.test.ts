import { computeActivity } from '@/lib/activity'
import type { Permit } from '@/lib/types'

function permit(overrides: Partial<Permit> = {}): Permit {
  return {
    permit_number: 'X',
    permit_type: '1',
    permit_type_definition: 'new construction',
    status: 'filed',
    description: null,
    address: '123 Main St',
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
    location: null,
    pipeline_status: null,
    pipeline_status_date: null,
    block: null,
    lot: null,
    ...overrides,
  }
}

const NOW = new Date('2026-07-25').getTime()

describe('computeActivity — windowing', () => {
  it('includes an event dated inside the window', () => {
    const events = computeActivity([permit({ filed_date: '2026-07-20' })], NOW)
    expect(events).toHaveLength(1)
    expect(events[0].stage).toBe('filed')
    expect(events[0].eventDate).toBe('2026-07-20')
  })

  it('excludes an event dated before the window', () => {
    const events = computeActivity([permit({ filed_date: '2026-05-01' })], NOW)
    expect(events).toHaveLength(0)
  })

  it('includes an event dated exactly on the window boundary', () => {
    // 30 days before 2026-07-25
    const events = computeActivity([permit({ filed_date: '2026-06-25' })], NOW)
    expect(events).toHaveLength(1)
  })

  it('excludes future-dated events (bad data)', () => {
    const events = computeActivity([permit({ filed_date: '2026-08-01' })], NOW)
    expect(events).toHaveLength(0)
  })

  it('honors a custom windowDays', () => {
    const permits = [permit({ filed_date: '2026-07-10' })] // 15 days ago
    expect(computeActivity(permits, NOW, { windowDays: 7 })).toHaveLength(0)
    expect(computeActivity(permits, NOW, { windowDays: 30 })).toHaveLength(1)
  })
})

describe('computeActivity — one event per permit', () => {
  it('emits a single event for the permit’s current milestone, not one per date', () => {
    // Filed long ago, issued recently → current stage is permitted, dated by issue.
    const events = computeActivity(
      [permit({ status: 'issued', filed_date: '2026-01-01', issued_date: '2026-07-18' })],
      NOW,
    )
    expect(events).toHaveLength(1)
    expect(events[0].stage).toBe('permitted')
    expect(events[0].eventDate).toBe('2026-07-18')
  })

  it('collapses duplicate permit numbers', () => {
    const events = computeActivity(
      [
        permit({ permit_number: 'A', filed_date: '2026-07-20' }),
        permit({ permit_number: 'A', filed_date: '2026-07-20' }),
      ],
      NOW,
    )
    expect(events).toHaveLength(1)
  })
})

describe('computeActivity — milestones', () => {
  it('surfaces "construction just started" from the pipeline status date', () => {
    const events = computeActivity(
      [
        permit({
          pipeline_status: 'Construction',
          pipeline_status_date: '2026-07-15',
          issued_date: '2026-02-01',
        }),
      ],
      NOW,
    )
    expect(events).toHaveLength(1)
    expect(events[0].stage).toBe('construction')
    expect(events[0].eventDate).toBe('2026-07-15')
  })

  it('surfaces a completion from completed_date', () => {
    const events = computeActivity(
      [permit({ status: 'complete', completed_date: '2026-07-22' })],
      NOW,
    )
    expect(events[0].stage).toBe('complete')
    expect(events[0].eventDate).toBe('2026-07-22')
  })

  it('skips inactive (cancelled/expired) permits', () => {
    const events = computeActivity(
      [permit({ status: 'cancelled', status_date: '2026-07-20', filed_date: '2026-07-01' })],
      NOW,
    )
    expect(events).toHaveLength(0)
  })

  it('skips permits with no usable driving date', () => {
    const events = computeActivity([permit({ status: 'issued', issued_date: null })], NOW)
    expect(events).toHaveLength(0)
  })
})

describe('computeActivity — significance ranking', () => {
  it('ranks higher net-homes events first', () => {
    const events = computeActivity(
      [
        permit({ permit_number: 'small', filed_date: '2026-07-20', proposed_units: '2', existing_units: '0' }),
        permit({ permit_number: 'big', filed_date: '2026-07-20', proposed_units: '120', existing_units: '0' }),
      ],
      NOW,
    )
    expect(events.map((e) => e.permit.permit_number)).toEqual(['big', 'small'])
    expect(events[0].netHomes).toBe(120)
  })

  it('breaks ties by most recent event date', () => {
    const events = computeActivity(
      [
        permit({ permit_number: 'older', filed_date: '2026-07-10' }),
        permit({ permit_number: 'newer', filed_date: '2026-07-22' }),
      ],
      NOW,
    )
    expect(events.map((e) => e.permit.permit_number)).toEqual(['newer', 'older'])
  })

  it('boosts pipeline-tracked projects over otherwise-equal permits', () => {
    const events = computeActivity(
      [
        permit({ permit_number: 'plain', filed_date: '2026-07-20' }),
        permit({ permit_number: 'tracked', filed_date: '2026-07-20', pipeline_status: 'BP Filed', pipeline_status_date: '2026-07-20' }),
      ],
      NOW,
    )
    expect(events[0].permit.permit_number).toBe('tracked')
  })

  it('respects an optional limit', () => {
    const permits = Array.from({ length: 5 }, (_, i) =>
      permit({ permit_number: `p${i}`, filed_date: '2026-07-20' }),
    )
    expect(computeActivity(permits, NOW, { limit: 3 })).toHaveLength(3)
  })
})

describe('computeActivity — edge cases', () => {
  it('returns an empty array for empty input', () => {
    expect(computeActivity([], NOW)).toEqual([])
  })

  it('reports netHomes as 0 (never negative) for unit-reducing permits', () => {
    const events = computeActivity(
      [permit({ filed_date: '2026-07-20', existing_units: '4', proposed_units: '1' })],
      NOW,
    )
    expect(events[0].netHomes).toBe(0)
  })

  it('parses estimated_cost into a number', () => {
    const events = computeActivity(
      [permit({ filed_date: '2026-07-20', estimated_cost: '2500000' })],
      NOW,
    )
    expect(events[0].cost).toBe(2500000)
  })
})
