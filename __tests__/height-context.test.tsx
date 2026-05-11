/**
 * @jest-environment jsdom
 */
import { render } from '@testing-library/react'
import { HeightContext } from '../components/HeightContext'

describe('HeightContext', () => {
  it('renders an empty-state message when height_ft is missing', () => {
    const { container } = render(<HeightContext height_ft={0} districtCode="UNKNOWN" />)
    expect(container.textContent).toMatch(/not specified/i)
  })
  it('renders the district label when height_ft is set', () => {
    const { container } = render(<HeightContext height_ft={40} districtCode="RH-1" />)
    expect(container.textContent).toMatch(/RH-1: 40 ft/)
  })
  it('includes all 10 references', () => {
    const { container } = render(<HeightContext height_ft={40} districtCode="RH-1" />)
    expect(container.textContent).toMatch(/Salesforce Tower/)
    expect(container.textContent).toMatch(/Painted Ladies/)
  })
})
