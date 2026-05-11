/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { FilterPopover } from '../components/FilterPopover'

describe('FilterPopover', () => {
  it('renders nothing when closed', () => {
    render(<FilterPopover open={false} onClose={() => {}}><div>body</div></FilterPopover>)
    expect(screen.queryByText('body')).toBeNull()
  })

  it('renders children when open', () => {
    render(<FilterPopover open={true} onClose={() => {}}><div>body</div></FilterPopover>)
    expect(screen.getByText('body')).toBeInTheDocument()
  })

  it('calls onClose when Escape is pressed', () => {
    const onClose = jest.fn()
    render(<FilterPopover open={true} onClose={onClose}><div>body</div></FilterPopover>)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not call onClose for non-Escape keys', () => {
    const onClose = jest.fn()
    render(<FilterPopover open={true} onClose={onClose}><div>body</div></FilterPopover>)
    fireEvent.keyDown(window, { key: 'a' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('does not listen for Escape when closed', () => {
    const onClose = jest.fn()
    render(<FilterPopover open={false} onClose={onClose}><div>body</div></FilterPopover>)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls onClose when clicking outside both the popover and anchor', () => {
    const onClose = jest.fn()
    render(
      <div>
        <button data-testid="outside">outside</button>
        <FilterPopover open={true} onClose={onClose}><div>body</div></FilterPopover>
      </div>,
    )
    fireEvent.mouseDown(screen.getByTestId('outside'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
