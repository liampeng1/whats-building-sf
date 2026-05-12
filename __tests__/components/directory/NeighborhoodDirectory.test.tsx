/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { NeighborhoodDirectory } from '@/components/directory/NeighborhoodDirectory'
import type { NhoodStats } from '@/lib/cross-stats'
import type { NhoodLensStats } from '@/lib/lens-stats'

const geo: NhoodStats[] = [
  { nhood: 'Mission', area_sqm: 1000,
    zoning_share: { Residential: 0.54, 'Mixed Use': 0.38, Commercial: 0.08 },
    transit_coverage: { '0.1mi': 0, '0.25mi': 0 }, near_rail_pct: 0.91 },
  { nhood: 'Outer Sunset', area_sqm: 2000,
    zoning_share: { Residential: 0.96, 'Mixed Use': 0.04 },
    transit_coverage: { '0.1mi': 0, '0.25mi': 0 }, near_rail_pct: 0.04 },
]
const lens: Record<string, NhoodLensStats> = {
  Mission:         { permits_12mo: 128, homes_added_12mo: 312, yoy_pct:  0.18, median_days_to_permit: 184 },
  'Outer Sunset':  { permits_12mo:   8, homes_added_12mo:  11, yoy_pct: -0.42, median_days_to_permit: 312 },
}

describe('NeighborhoodDirectory', () => {
  it('renders one row per neighborhood, sorted by permit count desc by default', () => {
    render(<NeighborhoodDirectory geo={geo} lens={lens} onSelect={() => {}} />)
    const rows = screen.getAllByRole('button', { name: /permits/i })
    expect(rows[0]).toHaveTextContent('Mission')
    expect(rows[1]).toHaveTextContent('Outer Sunset')
  })

  it('filters by search input (case-insensitive substring)', () => {
    render(<NeighborhoodDirectory geo={geo} lens={lens} onSelect={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'sunset' } })
    expect(screen.queryByText('Mission')).toBeNull()
    expect(screen.getByText('Outer Sunset')).toBeInTheDocument()
  })

  it('toggles to A–Z sort', () => {
    render(<NeighborhoodDirectory geo={geo} lens={lens} onSelect={() => {}} />)
    fireEvent.click(screen.getByText(/a–z/i))
    const rows = screen.getAllByRole('button', { name: /permits/i })
    expect(rows[0]).toHaveTextContent('Mission')
    expect(rows[1]).toHaveTextContent('Outer Sunset')
  })

  it('renders 5 metric chips with tooltip triggers', () => {
    render(<NeighborhoodDirectory geo={geo} lens={lens} onSelect={() => {}} />)
    // Each row: 5 ? chips. 2 rows × 5 = 10 chips total.
    expect(screen.getAllByText('?').length).toBeGreaterThanOrEqual(10)
  })

  it('calls onSelect with the nhood name when a row is clicked', () => {
    const onSelect = jest.fn()
    render(<NeighborhoodDirectory geo={geo} lens={lens} onSelect={onSelect} />)
    fireEvent.click(screen.getAllByRole('button', { name: /128 permits/i })[0])
    expect(onSelect).toHaveBeenCalledWith('Mission')
  })
})
