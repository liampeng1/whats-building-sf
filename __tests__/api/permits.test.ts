import { GET as listPermits } from '@/app/api/permits/route'
import { GET as getPermit } from '@/app/api/permits/[id]/route'
import * as datasf from '@/lib/datasf'

jest.mock('@/lib/datasf')

const mockPermit = {
  permit_number: '202301010001',
  permit_type: '8',
  permit_type_definition: 'otc alterations permit',
  status: 'issued',
  description: 'REPLACE HVAC UNIT',
  address: '123 MAIN ST',
  filed_date: '2023-01-01T00:00:00.000',
  issued_date: null,
  completed_date: null,
  location: { type: 'Point', coordinates: [-122.4194, 37.7749] },
}

describe('GET /api/permits', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('returns 200 with permit array', async () => {
    ;(datasf.fetchBuildingPermits as jest.Mock).mockResolvedValueOnce([mockPermit])
    const req = new Request('http://localhost/api/permits')
    const res = await listPermits(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
    expect(data[0].permit_number).toBe('202301010001')
  })

  test('calls datasf without bounds when no params present', async () => {
    ;(datasf.fetchBuildingPermits as jest.Mock).mockResolvedValueOnce([])
    const req = new Request('http://localhost/api/permits')
    await listPermits(req)
    expect(datasf.fetchBuildingPermits).toHaveBeenCalledWith()
  })

  test('passes parsed bounds to datasf when bounds params present', async () => {
    ;(datasf.fetchBuildingPermits as jest.Mock).mockResolvedValueOnce([])
    const req = new Request(
      'http://localhost/api/permits?north=37.8&south=37.7&east=-122.4&west=-122.5'
    )
    await listPermits(req)
    expect(datasf.fetchBuildingPermits).toHaveBeenCalledWith({
      north: 37.8,
      south: 37.7,
      east: -122.4,
      west: -122.5,
    })
  })

  test('ignores partial bounds params (calls without bounds)', async () => {
    ;(datasf.fetchBuildingPermits as jest.Mock).mockResolvedValueOnce([])
    const req = new Request('http://localhost/api/permits?north=37.8&south=37.7')
    await listPermits(req)
    expect(datasf.fetchBuildingPermits).toHaveBeenCalledWith()
  })

  test('returns 500 on DataSF error', async () => {
    ;(datasf.fetchBuildingPermits as jest.Mock).mockRejectedValueOnce(
      new Error('DataSF error: 503')
    )
    const req = new Request('http://localhost/api/permits')
    const res = await listPermits(req)
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data).toEqual({ error: 'Failed to fetch permits' })
  })
})

describe('GET /api/permits/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('returns 200 with single permit', async () => {
    ;(datasf.fetchBuildingPermit as jest.Mock).mockResolvedValueOnce(mockPermit)
    const req = new Request('http://localhost/api/permits/202301010001')
    const res = await getPermit(req, { params: Promise.resolve({ id: '202301010001' }) })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.permit_number).toBe('202301010001')
  })

  test('returns 404 when permit not found', async () => {
    ;(datasf.fetchBuildingPermit as jest.Mock).mockRejectedValueOnce(
      new Error('Permit not found')
    )
    const req = new Request('http://localhost/api/permits/nonexistent')
    const res = await getPermit(req, { params: Promise.resolve({ id: 'nonexistent' }) })
    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data).toEqual({ error: 'Permit not found' })
  })

  test('returns 500 on DataSF error', async () => {
    ;(datasf.fetchBuildingPermit as jest.Mock).mockRejectedValueOnce(
      new Error('DataSF error: 503')
    )
    const req = new Request('http://localhost/api/permits/any')
    const res = await getPermit(req, { params: Promise.resolve({ id: 'any' }) })
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data).toEqual({ error: 'Failed to fetch permit' })
  })
})
