/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { MetricHint } from '../../components/MetricHint'

describe('MetricHint', () => {
  it('renders a ? trigger with the metric label', () => {
    render(<MetricHint metric="nearRail" label="near rail" />)
    expect(screen.getByText('near rail')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /near rail/i })).toBeInTheDocument()
  })

  it('opens a tooltip with the definition on click', () => {
    render(<MetricHint metric="daysToPermit" label="days" />)
    fireEvent.click(screen.getByRole('button', { name: /days/i }))
    expect(screen.getByText(/median days from filed/i)).toBeInTheDocument()
  })

  it('renders nothing for an unknown metric (graceful degradation)', () => {
    // @ts-expect-error testing runtime fallback
    render(<MetricHint metric="bogus" label="x" />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('closes on Escape', () => {
    render(<MetricHint metric="nearRail" label="near rail" />)
    fireEvent.click(screen.getByRole('button', { name: /near rail/i }))
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('toggles closed on second click of the trigger', () => {
    render(<MetricHint metric="nearRail" label="near rail" />)
    const btn = screen.getByRole('button', { name: /near rail/i })
    fireEvent.click(btn)
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    fireEvent.click(btn)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })
})
