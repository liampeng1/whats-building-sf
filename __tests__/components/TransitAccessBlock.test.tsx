/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { TransitAccessBlock } from '@/components/NeighborhoodPanel'
import type { CrossStats, NhoodStats } from '@/lib/cross-stats'

function crossStatsWith(nhood: Partial<NhoodStats>): CrossStats {
  return {
    generated_at: '',
    source_versions: { neighborhoods: '', zoning_dataset: '', transit_stops_count: 0 },
    neighborhoods: [
      {
        nhood: 'Mission',
        area_sqm: 1000,
        zoning_share: {},
        transit_coverage: { '0.1mi': 0.07, '0.25mi': 0.24 },
        near_rail_pct: 0.8,
        ...nhood,
      } as NhoodStats,
    ],
    zoning: [],
    transit_bands: [],
    transit_tiers: [],
  }
}

describe('TransitAccessBlock', () => {
  it('renders the four transit tiers as land shares when tier_share is present', () => {
    const cs = crossStatsWith({
      tier_share: { rail: 0.42, 'rapid-bus': 0.18, 'local-bus': 0.11, poor: 0.29 },
    })
    render(<TransitAccessBlock crossStats={cs} neighborhood="Mission" />)
    expect(screen.getByText('Rail-served')).toBeInTheDocument()
    expect(screen.getByText('Rapid-bus only')).toBeInTheDocument()
    expect(screen.getByText('Local-bus only')).toBeInTheDocument()
    expect(screen.getByText('Transit-poor')).toBeInTheDocument()
    expect(screen.getByText('42%')).toBeInTheDocument()
    expect(screen.getByText('29%')).toBeInTheDocument()
    expect(screen.getByText(/by nearest frequent transit/)).toBeInTheDocument()
  })

  it('falls back to coverage bands when tier_share is absent', () => {
    const cs = crossStatsWith({}) // no tier_share
    render(<TransitAccessBlock crossStats={cs} neighborhood="Mission" />)
    expect(screen.getByText('within 0.1 mi')).toBeInTheDocument()
    expect(screen.getByText('within ¼ mi')).toBeInTheDocument()
    expect(screen.getByText(/Walking shed/)).toBeInTheDocument()
    expect(screen.queryByText('Rail-served')).not.toBeInTheDocument()
  })

  it('renders nothing when the neighborhood is not found', () => {
    const cs = crossStatsWith({})
    const { container } = render(<TransitAccessBlock crossStats={cs} neighborhood="Nowhere" />)
    expect(container).toBeEmptyDOMElement()
  })
})
