/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { ActivityList } from '@/components/ActivityList'
import type { ActivityEvent } from '@/lib/activity'
import type { Permit } from '@/lib/types'

const NOW = new Date('2026-07-25').getTime()

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

function evt(over: Partial<ActivityEvent> & { permit: Permit }): ActivityEvent {
  return {
    stage: 'filed',
    eventDate: '2026-07-20',
    netHomes: 0,
    cost: null,
    useCategory: 'other',
    score: 0,
    ...over,
  }
}

// Pre-sorted by significance (as the server delivers them).
const EVENTS: ActivityEvent[] = [
  evt({ permit: permit({ permit_number: 'a', address: 'A St' }), stage: 'filed', eventDate: '2026-07-10', score: 100 }),
  evt({ permit: permit({ permit_number: 'b', address: 'B St' }), stage: 'complete', eventDate: '2026-07-24', score: 50 }),
  evt({ permit: permit({ permit_number: 'c', address: 'C St' }), stage: 'filed', eventDate: '2026-07-20', score: 10 }),
]

function renderedAddresses(): string[] {
  return screen.getAllByTestId('activity-address').map((el) => el.textContent ?? '')
}

describe('ActivityList', () => {
  it('renders every event in the given (significance) order by default', () => {
    render(<ActivityList events={EVENTS} now={NOW} />)
    expect(renderedAddresses()).toEqual(['A St', 'B St', 'C St'])
  })

  it('re-sorts by most recent when "Newest" is selected', () => {
    render(<ActivityList events={EVENTS} now={NOW} />)
    fireEvent.click(screen.getByRole('button', { name: /newest/i }))
    expect(renderedAddresses()).toEqual(['B St', 'C St', 'A St'])
  })

  it('filters to a single stage when its chip is toggled on', () => {
    render(<ActivityList events={EVENTS} now={NOW} />)
    fireEvent.click(screen.getByRole('button', { name: /completed/i }))
    expect(renderedAddresses()).toEqual(['B St'])
  })

  it('shows a quiet empty state when no events match', () => {
    render(<ActivityList events={[]} now={NOW} />)
    expect(screen.queryAllByTestId('activity-address')).toHaveLength(0)
    expect(screen.getByText(/no major activity/i)).toBeInTheDocument()
  })
})
