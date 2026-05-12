/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { TransitDirectory } from '@/components/directory/TransitDirectory'
import type { TierStats } from '@/lib/cross-stats'
import type { TierLensStats } from '@/lib/lens-stats'

const geo: TierStats[] = [
  { tier: 'rail',       area_sqm: 1, share_of_sf: 0.08 },
  { tier: 'rapid-bus',  area_sqm: 1, share_of_sf: 0.18 },
  { tier: 'local-bus',  area_sqm: 1, share_of_sf: 0.52 },
  { tier: 'poor',       area_sqm: 1, share_of_sf: 0.22 },
]
const lens: Record<string, TierLensStats> = {
  rail:        { permits: 412, homes: 1840, dominant_zoning: 'Mixed Use' },
  'rapid-bus': { permits: 406, homes: 1408, dominant_zoning: 'Residential' },
  'local-bus': { permits: 361, homes: 1142, dominant_zoning: 'Residential' },
  poor:        { permits:  68, homes:  184, dominant_zoning: 'Residential' },
}

describe('TransitDirectory', () => {
  it('renders the four tiers in best→worst order', () => {
    render(<TransitDirectory geo={geo} lens={lens} onSelect={() => {}} />)
    const labels = screen.getAllByRole('heading', { level: 4 }).map((h) => h.textContent)
    expect(labels).toEqual(['Rail-served', 'Rapid-bus only', 'Local-bus only', 'Transit-poor'])
  })

  it('shows the tier definition under the label', () => {
    render(<TransitDirectory geo={geo} lens={lens} onSelect={() => {}} />)
    expect(screen.getByText(/BART, Muni Metro, or Caltrain/i)).toBeInTheDocument()
  })

  it('shows land share + permits + homes for each tier', () => {
    render(<TransitDirectory geo={geo} lens={lens} onSelect={() => {}} />)
    expect(screen.getByText(/^8% of SF$/)).toBeInTheDocument()
    expect(screen.getByText(/412 permits/)).toBeInTheDocument()
    expect(screen.getByText(/1,840 homes/)).toBeInTheDocument()
  })

  it('calls onSelect with the tier when a row is clicked', () => {
    const onSelect = jest.fn()
    render(<TransitDirectory geo={geo} lens={lens} onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: /rail-served/i }))
    expect(onSelect).toHaveBeenCalledWith('rail')
  })
})
