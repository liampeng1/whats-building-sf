/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { SummaryCard, type SummaryCardItem } from '../components/SummaryCard'

const items: SummaryCardItem[] = [
  { id: 'a', name: 'Mission',  count: 183 },
  { id: 'b', name: 'SoMa',     count: 147 },
  { id: 'c', name: 'Bayview',  count: 142 },
  { id: 'd', name: 'TL',       count: 98  },
  { id: 'e', name: 'Sunset',   count: 88  },
  { id: 'f', name: 'Excelsior',count: 76  },
  { id: 'g', name: 'NB',       count: 52  },
]

describe('SummaryCard', () => {
  it('renders the collapsed line in "none" state', () => {
    render(<SummaryCard state="none" summary="1,824 visible" items={items} onStateChange={() => {}} onItemClick={() => {}} eyebrow="Major projects" />)
    expect(screen.getByText('1,824 visible')).toBeInTheDocument()
    expect(screen.queryByText('Mission')).toBeNull()
  })
  it('renders top-5 in "top5" state', () => {
    render(<SummaryCard state="top5" summary="x" items={items} onStateChange={() => {}} onItemClick={() => {}} eyebrow="x" />)
    expect(screen.getByText('Mission')).toBeInTheDocument()
    expect(screen.getByText('Sunset')).toBeInTheDocument()  // 5th
    expect(screen.queryByText('Excelsior')).toBeNull()      // 6th
  })
  it('renders all items in "all" state', () => {
    render(<SummaryCard state="all" summary="x" items={items} onStateChange={() => {}} onItemClick={() => {}} eyebrow="x" />)
    expect(screen.getByText('Excelsior')).toBeInTheDocument()
    expect(screen.getByText('NB')).toBeInTheDocument()
  })
  it('cycles state via the click target', () => {
    const onStateChange = jest.fn()
    render(<SummaryCard state="top5" summary="x" items={items} onStateChange={onStateChange} onItemClick={() => {}} eyebrow="x" />)
    fireEvent.click(screen.getByText(/See all 7/))
    expect(onStateChange).toHaveBeenCalledWith('all')
  })
})
