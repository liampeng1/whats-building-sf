/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { TransitDirectory } from '@/components/directory/TransitDirectory'
import type { TierStats } from '@/lib/cross-stats'
import type { TierLensStats } from '@/lib/lens-stats'

const GEO: TierStats[] = [
  { tier: 'rail', area_sqm: 1000, share_of_sf: 0.26 },
  { tier: 'rapid-bus', area_sqm: 800, share_of_sf: 0.19 },
  { tier: 'local-bus', area_sqm: 600, share_of_sf: 0.13 },
  { tier: 'poor', area_sqm: 2000, share_of_sf: 0.42 },
]

const LENS: Record<string, TierLensStats> = {
  rail: { permits: 1240, homes: 3100, dominant_zoning: 'Mixed Use', use_mix: {} },
  'rapid-bus': { permits: 800, homes: 1500, dominant_zoning: 'Residential', use_mix: {} },
  'local-bus': { permits: 400, homes: 700, dominant_zoning: 'Residential', use_mix: {} },
  poor: { permits: 200, homes: 300, dominant_zoning: 'Residential', use_mix: {} },
}

describe('TransitDirectory', () => {
  it('renders a land-share row per tier with lens stats', () => {
    render(<TransitDirectory geo={GEO} lens={LENS} onSelect={() => {}} />)
    expect(screen.getByText('Rail-served')).toBeInTheDocument()
    expect(screen.getByText('Transit-poor')).toBeInTheDocument()
    // Land-share percentages render for each tier.
    expect(screen.getByText('26%')).toBeInTheDocument()
    expect(screen.getByText('42%')).toBeInTheDocument()
    expect(screen.getByText(/1,240 permits/)).toBeInTheDocument()
    expect(screen.getAllByText(/Mostly/).length).toBe(4)
    expect(screen.getByText(/Transit access · land share/)).toBeInTheDocument()
  })

  it('calls onSelect with the tier when a row is clicked', () => {
    const onSelect = jest.fn()
    render(<TransitDirectory geo={GEO} lens={LENS} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('Rail-served'))
    expect(onSelect).toHaveBeenCalledWith('rail')
  })

  it('marks the selected tier row as pressed', () => {
    render(
      <TransitDirectory geo={GEO} lens={LENS} onSelect={() => {}} selectedTier="rapid-bus" />,
    )
    const pressed = screen.getByRole('button', { pressed: true })
    expect(pressed).toHaveTextContent('Rapid-bus only')
  })
})
