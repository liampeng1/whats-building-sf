/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { TransitTierPanel } from '@/components/TransitTierPanel'
import type { TierStats } from '@/lib/cross-stats'
import type { TierLensStats } from '@/lib/lens-stats'
import type { Permit } from '@/lib/types'

// In jsdom no stations are loaded, so classifyTier() returns 'poor' for every
// permit. We therefore drive the panel with the 'poor' tier so the
// client-side sections (disparity homes-share, stage table, recent list) have
// deterministic data.
const STATS: TierStats[] = [
  { tier: 'rail', area_sqm: 1000, share_of_sf: 0.26 },
  { tier: 'poor', area_sqm: 2000, share_of_sf: 0.42 },
]

const LENS: Record<string, TierLensStats> = {
  poor: {
    permits: 12,
    homes: 40,
    dominant_zoning: 'Residential',
    use_mix: { housing: 0.75, retail: 0.25 },
  },
}

function permit(p: Partial<Permit>): Permit {
  return {
    permit_number: 'p1',
    status: 'filed',
    address: '123 Main St',
    status_date: '2025-03-01',
    existing_units: '0',
    proposed_units: '10',
    proposed_use: 'apartments',
    existing_use: null,
    location: { type: 'Point', coordinates: [-122.5, 37.7] },
    ...p,
  } as Permit
}

const PERMITS: Permit[] = [
  permit({ permit_number: 'a', proposed_units: '10', status_date: '2025-03-01' }),
  permit({ permit_number: 'b', proposed_units: '5', status: 'complete', completed_date: '2025-02-01', status_date: '2025-02-01' }),
]

describe('TransitTierPanel', () => {
  it('leads with the land-vs-homes disparity hero', () => {
    render(
      <TransitTierPanel tier="poor" stats={STATS} lens={LENS} permits={PERMITS} onOpenPermit={() => {}} onClose={() => {}} />,
    )
    expect(screen.getByText('Transit-poor')).toBeInTheDocument()
    // 42% land → 100% homes (both permits classify as poor in jsdom).
    expect(screen.getByText('42% → 100%')).toBeInTheDocument()
    expect(screen.getByText(/its land share/)).toBeInTheDocument()
  })

  it('renders the use-mix bars from lens use_mix', () => {
    render(
      <TransitTierPanel tier="poor" stats={STATS} lens={LENS} permits={PERMITS} onOpenPermit={() => {}} onClose={() => {}} />,
    )
    expect(screen.getByText('Housing')).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(screen.getByText('Retail')).toBeInTheDocument()
  })

  it('renders the pipeline-by-stage table with permit + home totals', () => {
    render(
      <TransitTierPanel tier="poor" stats={STATS} lens={LENS} permits={PERMITS} onOpenPermit={() => {}} onClose={() => {}} />,
    )
    expect(screen.getByText('Pipeline by stage')).toBeInTheDocument()
    expect(screen.getByText('Total')).toBeInTheDocument()
    // Stage labels appear in both the table and the recent-list chips.
    expect(screen.getAllByText('Filed').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Complete').length).toBeGreaterThan(0)
    // 15 homes total (10 + 5), unique in the table.
    expect(screen.getByText('15')).toBeInTheDocument()
  })

  it('fires onOpenPermit when a recent-permit row is clicked', () => {
    const onOpenPermit = jest.fn()
    render(
      <TransitTierPanel tier="poor" stats={STATS} lens={LENS} permits={PERMITS} onOpenPermit={onOpenPermit} onClose={() => {}} />,
    )
    fireEvent.click(screen.getAllByText('123 Main St')[0])
    expect(onOpenPermit).toHaveBeenCalled()
  })

  it('renders closed (aria-hidden) when no tier is selected', () => {
    const { container } = render(
      <TransitTierPanel tier={null} stats={STATS} lens={LENS} permits={PERMITS} onOpenPermit={() => {}} onClose={() => {}} />,
    )
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument()
  })
})
