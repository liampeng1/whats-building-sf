import {
  fetchBuildingPermits,
  fetchBuildingPermit,
  fetchPlanningCases,
  fetchPlanningCase,
  NotFoundError,
} from '@/lib/datasf'

const mockPermitApi = {
  permit_number: '202301010001',
  permit_type: '8',
  permit_type_definition: 'otc alterations permit',
  status: 'issued',
  description: 'REPLACE HVAC UNIT',
  street_number: '123',
  street_name: 'MAIN',
  street_suffix: 'ST',
  filed_date: '2023-01-01T00:00:00.000',
  issued_date: null,
  completed_date: null,
  location: { type: 'Point', coordinates: [-122.4194, 37.7749] },
}

const mockCaseApi = {
  record_id: '2025-012220PRJ',
  record_type: 'Conditional Use',
  description: 'New mixed-use building',
  project_address: '21 05TH AVE 94118',
  record_status: 'Under Review',
  open_date: '2023-06-01T00:00:00.000',
}

const mockBounds = { north: 37.8, south: 37.7, east: -122.4, west: -122.5 }

beforeEach(() => { global.fetch = jest.fn() })
afterEach(() => { jest.resetAllMocks() })

describe('fetchBuildingPermits', () => {
  test('fetches citywide permits when no bounds given', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => [mockPermitApi] })
    const permits = await fetchBuildingPermits()
    expect(permits).toHaveLength(1)
    expect(permits[0].permit_number).toBe('202301010001')
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string
    expect(url).not.toContain('within_box')
    expect(url).toContain('filed_date')
  })

  test('always restricts to tracked permit types (new construction + additions)', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => [mockPermitApi] })
    await fetchBuildingPermits()
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string
    const decoded = decodeURIComponent(url).replace(/\+/g, ' ')
    expect(decoded).toContain("permit_type IN ('1','2','3')")
  })

  test('always applies a 2-year recency filter on completed_date / status_date', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => [mockPermitApi] })
    await fetchBuildingPermits()
    const url = decodeURIComponent((global.fetch as jest.Mock).mock.calls[0][0] as string).replace(/\+/g, ' ')
    expect(url).toMatch(/completed_date >= '\d{4}-\d{2}-\d{2}'/)
    expect(url).toMatch(/status_date >= '\d{4}-\d{2}-\d{2}'/)
  })

  test('combines tracked-types filter with bounds via AND', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => [mockPermitApi] })
    await fetchBuildingPermits(mockBounds)
    const url = decodeURIComponent((global.fetch as jest.Mock).mock.calls[0][0] as string).replace(/\+/g, ' ')
    expect(url).toContain("permit_type IN ('1','2','3')")
    expect(url).toContain('within_box')
    expect(url).toContain(' AND ')
  })

  test('constructs address from street parts', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => [mockPermitApi] })
    const permits = await fetchBuildingPermits()
    expect(permits[0].address).toBe('123 MAIN ST')
  })

  test('handles missing street_suffix gracefully', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [{ ...mockPermitApi, street_suffix: null }],
    })
    const permits = await fetchBuildingPermits()
    expect(permits[0].address).toBe('123 MAIN')
  })

  test('preserves GeoJSON location', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => [mockPermitApi] })
    const permits = await fetchBuildingPermits()
    expect(permits[0].location).toEqual({ type: 'Point', coordinates: [-122.4194, 37.7749] })
  })

  test('includes within_box filter when bounds provided', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => [mockPermitApi] })
    await fetchBuildingPermits(mockBounds)
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string
    expect(url).toContain('within_box')
    expect(url).toContain('37.8')
    expect(url).toContain('-122.5')
  })

  test('throws on DataSF API error', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 503 })
    await expect(fetchBuildingPermits()).rejects.toThrow('DataSF error: 503')
  })
})

describe('fetchBuildingPermit', () => {
  test('fetches single permit by permit_number', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => [mockPermitApi] })
    const permit = await fetchBuildingPermit('202301010001')
    expect(permit.permit_number).toBe('202301010001')
    expect(permit.address).toBe('123 MAIN ST')
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string
    expect(url).toContain('permit_number=202301010001')
  })

  test('throws NotFoundError when permit not found', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => [] })
    await expect(fetchBuildingPermit('nonexistent')).rejects.toBeInstanceOf(NotFoundError)
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => [] })
    await expect(fetchBuildingPermit('nonexistent')).rejects.toThrow('Permit not found')
  })
})

describe('fetchPlanningCases', () => {
  test('fetches recent cases (no bounds parameter)', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => [mockCaseApi] })
    const cases = await fetchPlanningCases()
    expect(cases).toHaveLength(1)
    expect(cases[0].record_id).toBe('2025-012220PRJ')
    expect(cases[0].project_address).toBe('21 05TH AVE 94118')
    expect(cases[0].record_status).toBe('Under Review')
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string
    expect(url).not.toContain('within_box')
    expect(url).toContain('open_date')
    expect(url).toContain('qvu5-m3a2')
  })

  test('throws on DataSF API error', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 429 })
    await expect(fetchPlanningCases()).rejects.toThrow('DataSF error: 429')
  })

  test('strips unknown fields from API response', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [{ ...mockCaseApi, block: '1353', lot: '003', applicant: 'Acme', pim_link: 'https://example' }],
    })
    const cases = await fetchPlanningCases()
    expect(cases[0]).not.toHaveProperty('block')
    expect(cases[0]).not.toHaveProperty('lot')
    expect(cases[0]).not.toHaveProperty('applicant')
    expect(cases[0]).not.toHaveProperty('pim_link')
    expect(Object.keys(cases[0]).sort()).toEqual(
      ['description', 'open_date', 'project_address', 'record_id', 'record_status', 'record_type'],
    )
  })

  test('defaults missing description and open_date to null', async () => {
    const { description: _d, open_date: _o, ...partial } = mockCaseApi
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => [partial] })
    const cases = await fetchPlanningCases()
    expect(cases[0].description).toBeNull()
    expect(cases[0].open_date).toBeNull()
  })
})

describe('fetchPlanningCase', () => {
  test('fetches single case by record_id', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => [mockCaseApi] })
    const c = await fetchPlanningCase('2025-012220PRJ')
    expect(c.record_id).toBe('2025-012220PRJ')
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string
    expect(url).toContain('record_id=2025-012220PRJ')
  })

  test('throws NotFoundError when case not found', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => [] })
    await expect(fetchPlanningCase('nonexistent')).rejects.toBeInstanceOf(NotFoundError)
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => [] })
    await expect(fetchPlanningCase('nonexistent')).rejects.toThrow('Planning case not found')
  })

  test('strips unknown fields and defaults nullables on single record', async () => {
    const { description: _d, open_date: _o, ...partial } = mockCaseApi
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [{ ...partial, block: '1353', applicant: 'Acme' }],
    })
    const c = await fetchPlanningCase('2025-012220PRJ')
    expect(c).not.toHaveProperty('block')
    expect(c).not.toHaveProperty('applicant')
    expect(c.description).toBeNull()
    expect(c.open_date).toBeNull()
  })
})
