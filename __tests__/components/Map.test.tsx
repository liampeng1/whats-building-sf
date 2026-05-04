/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import Map from '@/components/Map'

jest.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => null,
  CircleMarker: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useMapEvents: () => ({}),
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('leaflet/dist/leaflet.css', () => ({}))

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => [] })
})

afterEach(() => {
  jest.resetAllMocks()
})

test('renders map container', () => {
  render(<Map />)
  expect(screen.getByTestId('map-container')).toBeInTheDocument()
})

test('fetches permits on mount', () => {
  render(<Map />)
  expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/permits'))
})
