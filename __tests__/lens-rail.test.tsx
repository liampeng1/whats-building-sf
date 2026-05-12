/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { LensRail } from '@/components/LensRail'

describe('LensRail (expandable)', () => {
  it('renders three chips', () => {
    render(<LensRail mode="neighborhoods" onChange={() => {}} open={null} onOpenChange={() => {}} />)
    expect(screen.getByRole('radio', { name: 'Neighborhoods' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Zoning' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Transit' })).toBeInTheDocument()
  })

  it('clicking the active mode opens the drawer', () => {
    const onOpenChange = jest.fn()
    render(<LensRail mode="neighborhoods" onChange={() => {}} open={null} onOpenChange={onOpenChange} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Neighborhoods' }))
    expect(onOpenChange).toHaveBeenCalledWith('neighborhoods')
  })

  it('clicking the active + open chip closes the drawer (toggle)', () => {
    const onOpenChange = jest.fn()
    render(<LensRail mode="neighborhoods" onChange={() => {}} open="neighborhoods" onOpenChange={onOpenChange} />)
    fireEvent.click(screen.getByRole('radio', { name: /Neighborhoods/i }))
    expect(onOpenChange).toHaveBeenCalledWith(null)
  })

  it('clicking a different mode while open swaps + keeps open', () => {
    const onChange = jest.fn()
    const onOpenChange = jest.fn()
    render(<LensRail mode="neighborhoods" onChange={onChange} open="neighborhoods" onOpenChange={onOpenChange} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Zoning' }))
    expect(onChange).toHaveBeenCalledWith('zoning')
    expect(onOpenChange).toHaveBeenCalledWith('zoning')
  })
})
