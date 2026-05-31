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
  expect(links.some((a) => a.href.includes('/sf_planning/0-0-0-56337'))).toBe(true)   // §209.2 classification deep-link
  expect(links.some((a) => a.href.includes('sfplanning.org') && a.href.includes('.pdf'))).toBe(true) // source doc
})

it('reveals the verbatim "what the code says" disclosure for a rule', () => {
  render(<ZoningDistrictPanel zoningSim="RM-2" gen="Residential" districtName="RM-2" onClose={() => {}} />)
  // The progressive-disclosure summary exists, and the verbatim source sentence
  // is in the DOM (inside the collapsed <details>).
  expect(screen.getAllByText(/what the code says/i).length).toBeGreaterThan(0)
  expect(screen.getByText(/Three dwelling units per lot or one dwelling unit per 600 sq\.ft\./i)).toBeInTheDocument()
})

it('renders RTO-1 mix + parking rows and omits non-residential FAR', () => {
  render(<ZoningDistrictPanel zoningSim="RTO-1" gen="Residential" districtName="RTO-1" onClose={() => {}} />)
  expect(screen.getByText(/Dwelling-unit mix:/i)).toBeInTheDocument()
  expect(screen.getByText(/Parking:/i)).toBeInTheDocument()
  expect(screen.queryByText(/FAR \(non-residential\)/i)).not.toBeInTheDocument()  // "Not Applicable" → omitted
  const links = screen.getAllByRole('link') as HTMLAnchorElement[]
  expect(links.some((a) => a.href.includes('/sf_planning/'))).toBe(true)  // §-deep-links present
})

it('renders Public (P) with its controls note and no crash on absent metrics', () => {
  render(<ZoningDistrictPanel zoningSim="P" gen="Public" districtName="P" onClose={() => {}} />)
  expect(screen.getByText(/uses governed by §211/i)).toBeInTheDocument()
})
