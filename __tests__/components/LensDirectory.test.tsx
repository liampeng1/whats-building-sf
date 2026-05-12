/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { LensDirectory } from '@/components/LensDirectory'

const fakeCross = {
  generated_at: '',
  source_versions: { neighborhoods: '', zoning_dataset: '', transit_stops_count: 0 },
  neighborhoods: [], zoning: [], transit_bands: [],
  transit_tiers: [
    { tier: 'rail', area_sqm: 1, share_of_sf: 0.08 },
    { tier: 'rapid-bus', area_sqm: 1, share_of_sf: 0.18 },
    { tier: 'local-bus', area_sqm: 1, share_of_sf: 0.52 },
    { tier: 'poor', area_sqm: 1, share_of_sf: 0.22 },
  ],
} as any
const fakeLens = { neighborhoods: {}, zoning: {}, transit_tiers: {} } as any

describe('LensDirectory', () => {
  it('returns null when mode is null (closed)', () => {
    const { container } = render(
      <LensDirectory mode={null} crossStats={fakeCross} lensStats={fakeLens}
        statusLine="x" onClose={() => {}} onSelectRegion={() => {}} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders the neighborhoods directory when mode = neighborhoods', () => {
    render(
      <LensDirectory mode="neighborhoods" crossStats={fakeCross} lensStats={fakeLens}
        statusLine="1,247 visible" onClose={() => {}} onSelectRegion={() => {}} />
    )
    expect(screen.getByPlaceholderText(/search 41 neighborhoods/i)).toBeInTheDocument()
  })

  it('renders the zoning directory when mode = zoning', () => {
    render(
      <LensDirectory mode="zoning" crossStats={fakeCross} lensStats={fakeLens}
        statusLine="x" onClose={() => {}} onSelectRegion={() => {}} />
    )
    expect(screen.getByText('Showing')).toBeInTheDocument()
  })

  it('renders the transit directory when mode = transit', () => {
    render(
      <LensDirectory mode="transit" crossStats={fakeCross} lensStats={fakeLens}
        statusLine="x" onClose={() => {}} onSelectRegion={() => {}} />
    )
    expect(screen.getByText('Rail-served')).toBeInTheDocument()
  })

  it('closes on ESC', () => {
    const onClose = jest.fn()
    render(
      <LensDirectory mode="neighborhoods" crossStats={fakeCross} lensStats={fakeLens}
        statusLine="x" onClose={onClose} onSelectRegion={() => {}} />
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('renders bottom-anchored on narrow viewports', () => {
    Object.defineProperty(window, 'innerWidth', { value: 400, configurable: true })
    window.dispatchEvent(new Event('resize'))
    render(
      <LensDirectory mode="neighborhoods" crossStats={fakeCross} lensStats={fakeLens}
        statusLine="x" onClose={() => {}} onSelectRegion={() => {}} />
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog.className).toMatch(/bottom-0/)
  })

  it('closes on click outside the drawer', () => {
    const onClose = jest.fn()
    render(
      <>
        <div data-testid="outside">other content</div>
        <LensDirectory mode="neighborhoods" crossStats={fakeCross} lensStats={fakeLens}
          statusLine="x" onClose={onClose} onSelectRegion={() => {}} />
      </>
    )
    fireEvent.mouseDown(screen.getByTestId('outside'))
    expect(onClose).toHaveBeenCalled()
  })

  it('does not close when clicking a LensRail chip (those have own logic)', () => {
    const onClose = jest.fn()
    render(
      <>
        <button role="radio" data-testid="chip">chip</button>
        <LensDirectory mode="neighborhoods" crossStats={fakeCross} lensStats={fakeLens}
          statusLine="x" onClose={onClose} onSelectRegion={() => {}} />
      </>
    )
    fireEvent.mouseDown(screen.getByTestId('chip'))
    expect(onClose).not.toHaveBeenCalled()
  })
})
