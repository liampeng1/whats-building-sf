import { GET as listPlanning } from '@/app/api/planning/route'
import { GET as getPlanning } from '@/app/api/planning/[id]/route'
import * as datasf from '@/lib/datasf'
import { NotFoundError } from '@/lib/datasf'

jest.mock('@/lib/datasf', () => {
  const actual = jest.requireActual('@/lib/datasf')
  return {
    ...actual,
    fetchPlanningCases: jest.fn(),
    fetchPlanningCase: jest.fn(),
  }
})

const mockCase = {
  record_id: '2025-012220PRJ',
  record_type: 'Conditional Use',
  description: 'New mixed-use building',
  project_address: '21 05TH AVE 94118',
  record_status: 'Under Review',
  open_date: '2023-06-01T00:00:00.000',
}

describe('GET /api/planning', () => {
  let consoleErrorSpy: jest.SpyInstance
  beforeEach(() => {
    jest.clearAllMocks()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  test('returns 200 with planning case array', async () => {
    ;(datasf.fetchPlanningCases as jest.Mock).mockResolvedValueOnce([mockCase])
    const req = new Request('http://localhost/api/planning')
    const res = await listPlanning(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
    expect(data[0].record_id).toBe('2025-012220PRJ')
    expect(datasf.fetchPlanningCases).toHaveBeenCalledWith()
  })

  test('returns 500 on DataSF error', async () => {
    ;(datasf.fetchPlanningCases as jest.Mock).mockRejectedValueOnce(
      new Error('DataSF error: 503')
    )
    const req = new Request('http://localhost/api/planning')
    const res = await listPlanning(req)
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data).toEqual({ error: 'Failed to fetch planning cases' })
    expect(consoleErrorSpy).toHaveBeenCalled()
  })
})

describe('GET /api/planning/[id]', () => {
  let consoleErrorSpy: jest.SpyInstance
  beforeEach(() => {
    jest.clearAllMocks()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  test('returns 200 with single planning case', async () => {
    ;(datasf.fetchPlanningCase as jest.Mock).mockResolvedValueOnce(mockCase)
    const req = new Request('http://localhost/api/planning/2025-012220PRJ')
    const res = await getPlanning(req, {
      params: Promise.resolve({ id: '2025-012220PRJ' }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.record_id).toBe('2025-012220PRJ')
  })

  test('returns 404 when planning case not found', async () => {
    ;(datasf.fetchPlanningCase as jest.Mock).mockRejectedValueOnce(
      new NotFoundError('Planning case not found')
    )
    const req = new Request('http://localhost/api/planning/nonexistent')
    const res = await getPlanning(req, {
      params: Promise.resolve({ id: 'nonexistent' }),
    })
    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data).toEqual({ error: 'Planning case not found' })
  })

  test('returns 500 on DataSF error', async () => {
    ;(datasf.fetchPlanningCase as jest.Mock).mockRejectedValueOnce(
      new Error('DataSF error: 503')
    )
    const req = new Request('http://localhost/api/planning/any')
    const res = await getPlanning(req, {
      params: Promise.resolve({ id: 'any' }),
    })
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data).toEqual({ error: 'Failed to fetch planning case' })
  })
})
