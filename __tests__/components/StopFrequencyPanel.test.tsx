/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { StopFrequencyPanel } from '@/components/StopFrequencyPanel'
import { FREQ_STOPS, markFreqStopsChanged, type FreqStop } from '@/lib/transit-stations'

const STOP: FreqStop = {
  id: 'freq-1-mission-24th',
  name: 'Mission St & 24th St',
  lat: 37.752,
  lng: -122.418,
  routes: [
    { route: '12', mode: 'bus', peakTph: 3, offPeakTph: 3 },
    { route: '49', mode: 'bus', peakTph: 11, offPeakTph: 10 },
    { route: '14R', mode: 'bus', peakTph: 12, offPeakTph: 7 },
    { route: 'J', mode: 'muni-metro', peakTph: 8, offPeakTph: 6 },
  ],
}

beforeEach(() => {
  FREQ_STOPS.length = 0
  FREQ_STOPS.push(STOP)
  markFreqStopsChanged()
})

describe('StopFrequencyPanel', () => {
  it('renders the stop name and every route serving it', () => {
    render(<StopFrequencyPanel stopId={STOP.id} onClose={() => {}} />)
    expect(screen.getByText('Mission St & 24th St')).toBeInTheDocument()
    expect(screen.getByText('14R')).toBeInTheDocument()
    expect(screen.getByText('49')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
  })

  it('formats peak / midday headways', () => {
    render(<StopFrequencyPanel stopId={STOP.id} onClose={() => {}} />)
    // 14R: 12 tph peak → 5 min, 7 tph midday → 9 min
    expect(screen.getByText('5 min / 9 min')).toBeInTheDocument()
  })

  it('orders routes by peak frequency (most frequent first)', () => {
    render(<StopFrequencyPanel stopId={STOP.id} onClose={() => {}} />)
    const rows = screen.getAllByRole('listitem').map((n) => n.textContent)
    // 14R(12) > 49(11) > J(8) > 12(3)
    expect(rows[0]).toContain('14R')
    expect(rows[rows.length - 1]).toContain('12')
  })

  it('renders nothing actionable for an unknown stop id', () => {
    const { container } = render(<StopFrequencyPanel stopId="nope" onClose={() => {}} />)
    expect(container.textContent).not.toContain('Mission')
  })
})
