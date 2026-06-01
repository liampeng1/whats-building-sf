/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { TransitTierPanel } from '@/components/TransitTierPanel'
import type { TierStats } from '@/lib/cross-stats'
import type { TierLensStats } from '@/lib/lens-stats'

const STATS: TierStats[] = [
  { tier: 'rail', area_sqm: 1000, share_of_sf: 0.26 },
  { tier: 'poor', area_sqm: 2000, share_of_sf: 0.42 },
]

const LENS: Record<string, TierLensStats> = {
  rail: { permits: 1240, homes: 3100, dominant_zoning: 'Mixed Use' },
}

describe('TransitTierPanel', () => {
  it('shows the tier title, land-share hero, and recent activity when a tier is selected', () => {
    render(<TransitTierPanel tier="rail" stats={STATS} lens={LENS} onClose={() => {}} />)
    expect(screen.getByText('Rail-served')).toBeInTheDocument()
    expect(screen.getByText('26%')).toBeInTheDocument()
    expect(screen.getByText('1,240')).toBeInTheDocument()
    expect(screen.getByText('3,100')).toBeInTheDocument()
    expect(screen.getByText(/Mostly Mixed Use/)).toBeInTheDocument()
  })

  it('renders closed (aria-hidden) when no tier is selected', () => {
    const { container } = render(
      <TransitTierPanel tier={null} stats={STATS} lens={LENS} onClose={() => {}} />,
    )
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument()
  })
})
