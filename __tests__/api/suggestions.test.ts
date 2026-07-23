import { NextRequest } from 'next/server'
import { POST } from '@/app/api/suggestions/route'
import { createIssue } from '@/lib/github-issues'
import { rateLimit } from '@/lib/rate-limit'

jest.mock('@/lib/github-issues', () => ({ createIssue: jest.fn() }))
jest.mock('@/lib/rate-limit', () => ({ rateLimit: jest.fn() }))

const mockCreate = createIssue as jest.MockedFunction<typeof createIssue>
const mockRate = rateLimit as jest.MockedFunction<typeof rateLimit>

function post(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/suggestions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '1.2.3.4',
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/suggestions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRate.mockResolvedValue({ ok: true, remaining: 24 })
    mockCreate.mockResolvedValue({
      url: 'https://github.com/liampeng1/whats-building-sf/issues/9',
      number: 9,
    })
  })

  it('files an issue and returns its url on the happy path', async () => {
    const res = await POST(post({ message: 'add dark mode' }))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      ok: true,
      url: 'https://github.com/liampeng1/whats-building-sf/issues/9',
      number: 9,
    })
    expect(mockCreate).toHaveBeenCalledTimes(1)
  })

  it('silently drops honeypot submissions without filing', async () => {
    const res = await POST(post({ message: 'spam', company: 'AcmeBot' }))
    expect(res.status).toBe(200)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('returns 429 when rate limited', async () => {
    mockRate.mockResolvedValue({ ok: false, remaining: 0 })
    const res = await POST(post({ message: 'again' }))
    expect(res.status).toBe(429)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('returns 400 for an invalid submission', async () => {
    const res = await POST(post({ message: '   ' }))
    expect(res.status).toBe(400)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('returns 502 when GitHub fails', async () => {
    mockCreate.mockRejectedValue(new Error('GitHub responded 403'))
    const res = await POST(post({ message: 'add dark mode' }))
    expect(res.status).toBe(502)
  })

  it('keys the rate limit on the rightmost x-forwarded-for hop, not the spoofable leftmost one', async () => {
    await POST(
      post(
        { message: 'add dark mode' },
        { 'x-forwarded-for': '1.1.1.1, 2.2.2.2, 10.0.0.1' },
      ),
    )
    expect(mockRate).toHaveBeenCalledWith('suggest:rl:10.0.0.1', 25, 86_400)
  })

  it('prefers x-real-ip over x-forwarded-for when both are present', async () => {
    await POST(
      post(
        { message: 'add dark mode' },
        { 'x-forwarded-for': '1.1.1.1, 2.2.2.2', 'x-real-ip': '9.9.9.9' },
      ),
    )
    expect(mockRate).toHaveBeenCalledWith('suggest:rl:9.9.9.9', 25, 86_400)
  })
})
