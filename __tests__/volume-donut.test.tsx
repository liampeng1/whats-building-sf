/**
 * @jest-environment jsdom
 */
import { render } from '@testing-library/react'
import { VolumeDonut } from '../components/VolumeDonut'

describe('VolumeDonut', () => {
  it('renders an SVG', () => {
    const { container } = render(<VolumeDonut count={50} maxCount={100} />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
  it('zero count still renders a minimum-size donut', () => {
    const { container } = render(<VolumeDonut count={0} maxCount={100} />)
    const circles = container.querySelectorAll('circle')
    expect(circles.length).toBe(2)
  })
  it('count === maxCount yields the largest size', () => {
    const { container } = render(<VolumeDonut count={100} maxCount={100} maxDiameter={28} />)
    const outer = container.querySelector('circle')
    expect(outer?.getAttribute('r')).toBe('14')   // half of 28
  })
})
