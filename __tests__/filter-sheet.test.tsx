/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { FilterSheet } from '../components/FilterSheet'

const noop = () => {}

const baseProps = {
  open: true,
  onClose: jest.fn(),
  mode: 'neighborhoods' as const,
  onModeChange: noop,
  selectedStages: new Set(['filed' as const]) as unknown as Set<import('@/lib/permit-style').PermitStage>,
  onToggleStage: noop,
  onSetStages: noop,
  selectedCategories: new Set(['housing' as const]) as unknown as Set<import('@/lib/permit-style').UseCategory>,
  onToggleCategory: noop,
  onSetCategories: noop,
  minUnits: 2 as const,
  onMinUnitsChange: noop,
  completedYears: 2 as const,
  onCompletedYearsChange: noop,
  recentActivity: 24 as const,
  onRecentActivityChange: noop,
  transit: 'off' as const,
  onTransitChange: noop,
}

describe('FilterSheet', () => {
  it('renders nothing when closed', () => {
    render(<FilterSheet {...baseProps} open={false} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('renders when open', () => {
    render(<FilterSheet {...baseProps} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
  it('Escape calls onClose', () => {
    const onClose = jest.fn()
    render(<FilterSheet {...baseProps} onClose={onClose} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
