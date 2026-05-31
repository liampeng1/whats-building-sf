/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { ZoningDistrictPanel } from '../components/ZoningDistrictPanel'

it('shows verified RM-2 rules, a verbatim quote, and a real amlegal link', () => {
  render(<ZoningDistrictPanel zoningSim="RM-2" gen="Residential" districtName="RM-2" onClose={() => {}} />)
  // "600 sq.ft." shows in the density label AND its collapsed verbatim quote.
  expect(screen.getAllByText(/600 sq\.ft\./i).length).toBeGreaterThan(0)  // density/quote
  expect(screen.getAllByText(/80 sq\.ft\./i).length).toBeGreaterThan(0)   // open space
  const links = screen.getAllByRole('link') as HTMLAnchorElement[]
  expect(links.some((a) => a.href.includes('/sf_planning/0-0-0-19952'))).toBe(true)   // §207 deep-link
  expect(links.some((a) => a.href.includes('sfplanning.org') && a.href.includes('.pdf'))).toBe(true) // source doc
})
