/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { ZoningDirectory } from '@/components/directory/ZoningDirectory'
import type { ZoningStats } from '@/lib/cross-stats'
import type { ZoningLensStats } from '@/lib/lens-stats'

const geo: ZoningStats[] = [
  { category: 'Residential', area_sqm: 1, share_of_sf: 0.78,
    neighborhood_share: {}, transit_coverage: { '0.1mi': 0, '0.25mi': 0 },
    districts: [
      { code: 'RH-1', name: 'Single-family', description: 'SFH-only — most of SF residential land', land_share_within_cat: 0.52 },
      { code: 'RH-2', name: 'Two-unit',      description: 'Duplex',                                 land_share_within_cat: 0.14 },
    ],
  },
  { category: 'Mixed Use', area_sqm: 1, share_of_sf: 0.08,
    neighborhood_share: {}, transit_coverage: { '0.1mi': 0, '0.25mi': 0 },
    districts: [],
  },
]
const lens: Record<string, ZoningLensStats> = {
  Residential: { permits_share: 0.34, top_neighborhoods: ['Sunset', 'Richmond', 'Bayview'] },
  'Mixed Use': { permits_share: 0.41, top_neighborhoods: ['Mission', 'SoMa', 'Hayes Valley'] },
}

describe('ZoningDirectory', () => {
  it('renders one row per zoning category', () => {
    render(<ZoningDirectory geo={geo} lens={lens} onSelect={() => {}} />)
    expect(screen.getByText('Residential')).toBeInTheDocument()
    expect(screen.getByText('Mixed Use')).toBeInTheDocument()
  })

  it('expands a category on click and shows its districts', () => {
    render(<ZoningDirectory geo={geo} lens={lens} onSelect={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /residential/i }))
    expect(screen.getByText('RH-1')).toBeInTheDocument()
    expect(screen.getByText('RH-2')).toBeInTheDocument()
  })

  it('collapses a category on second click', () => {
    render(<ZoningDirectory geo={geo} lens={lens} onSelect={() => {}} />)
    const head = screen.getByRole('button', { name: /residential/i })
    fireEvent.click(head)
    fireEvent.click(head)
    expect(screen.queryByText('RH-1')).toBeNull()
  })

  it('renders Land and Permits bars with shared-tooltip labels', () => {
    render(<ZoningDirectory geo={geo} lens={lens} onSelect={() => {}} />)
    expect(screen.getAllByText(/land/i)[0]).toBeInTheDocument()
    expect(screen.getAllByText(/permits/i)[0]).toBeInTheDocument()
  })
})
