import { rateLimit } from '@/lib/rate-limit'

// Mock the dynamic import of @upstash/redis.
const incr = jest.fn()
const expire = jest.fn()
jest.mock('@upstash/redis', () => ({
  Redis: jest.fn().mockImplementation(() => ({ incr, expire })),
}))

describe('rateLimit', () => {
  const OLD_ENV = process.env
  beforeEach(() => {
    jest.clearAllMocks()
    process.env = {
      ...OLD_ENV,
      UPSTASH_REDIS_REST_URL: 'https://redis.example',
      UPSTASH_REDIS_REST_TOKEN: 'tok',
    }
  })
  afterEach(() => {
    process.env = OLD_ENV
  })

  it('allows under the cap and sets TTL on the first hit', async () => {
    incr.mockResolvedValue(1)
    const res = await rateLimit('suggest:rl:1.2.3.4', 25, 86_400)
    expect(res.ok).toBe(true)
    expect(expire).toHaveBeenCalledWith('suggest:rl:1.2.3.4', 86_400)
  })

  it('does not reset TTL on later hits', async () => {
    incr.mockResolvedValue(5)
    const res = await rateLimit('suggest:rl:1.2.3.4', 25, 86_400)
    expect(res.ok).toBe(true)
    expect(expire).not.toHaveBeenCalled()
  })

  it('blocks once the count exceeds the cap', async () => {
    incr.mockResolvedValue(26)
    const res = await rateLimit('suggest:rl:1.2.3.4', 25, 86_400)
    expect(res.ok).toBe(false)
  })

  it('fails open when Redis creds are absent', async () => {
    process.env = { ...OLD_ENV, UPSTASH_REDIS_REST_URL: '', UPSTASH_REDIS_REST_TOKEN: '' }
    const res = await rateLimit('suggest:rl:1.2.3.4', 25, 86_400)
    expect(res.ok).toBe(true)
    expect(incr).not.toHaveBeenCalled()
  })

  it('fails open when Redis throws', async () => {
    incr.mockRejectedValue(new Error('network'))
    const res = await rateLimit('suggest:rl:1.2.3.4', 25, 86_400)
    expect(res.ok).toBe(true)
  })
})
