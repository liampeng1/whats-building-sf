// Fixed-window per-key rate limiter backed by Upstash Redis. Reuses the same
// env creds + dynamic-import pattern as lib/permit-cache.ts. Fails OPEN: if
// Redis is unconfigured or unreachable, the request is allowed through.

function getRedisCreds(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN
  if (!url || !token) return null
  return { url, token }
}

/**
 * Increment `key` within a `windowSeconds` window. Returns ok=false once the
 * count exceeds `limit`. Fails open (ok=true) if Redis is unavailable.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ ok: boolean; remaining: number }> {
  const creds = getRedisCreds()
  if (!creds) return { ok: true, remaining: limit }
  try {
    const { Redis } = await import('@upstash/redis')
    const redis = new Redis({ url: creds.url, token: creds.token })
    const count = await redis.incr(key)
    if (count === 1) await redis.expire(key, windowSeconds)
    return { ok: count <= limit, remaining: Math.max(0, limit - count) }
  } catch {
    return { ok: true, remaining: limit }
  }
}
