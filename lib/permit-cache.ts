/**
 * Daily-snapshot cache for the full permits dataset, backed by Upstash Redis
 * (provisioned via Vercel Marketplace; replaces the sunset @vercel/kv).
 *
 * Architecture:
 *   - A daily Vercel cron route fetches the *complete* tracked permits +
 *     pipeline statuses + assessor parcel IDs from DataSF and writes the
 *     full array as a single Redis value under PERMITS_KEY.
 *   - Every API request reads that snapshot and filters in memory.
 *   - When Upstash isn't provisioned (env vars missing) or the snapshot is
 *     missing, callers fall back to a live DataSF fetch — nothing breaks.
 */

import type { Permit } from './types'

const PERMITS_KEY = 'permits:tracked-snapshot:v1'
const SNAPSHOT_MAX_AGE_MS = 48 * 60 * 60 * 1000 // 48h — even if cron stalls a day

interface PermitSnapshot {
  capturedAt: number
  permits: Permit[]
}

// Vercel's Upstash KV integration ships KV_* env vars (legacy compat with
// the sunset @vercel/kv product). Direct Upstash setups use UPSTASH_* vars.
// We accept either.
function getRedisCreds(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN
  if (!url || !token) return null
  return { url, token }
}

function isRedisConfigured(): boolean {
  return getRedisCreds() !== null
}

/**
 * Returns the cached permits array if a fresh snapshot exists.
 * Returns null when Redis isn't configured, the snapshot is missing, or it's
 * stale beyond SNAPSHOT_MAX_AGE_MS.
 */
async function getRedis() {
  const creds = getRedisCreds()
  if (!creds) return null
  const { Redis } = await import('@upstash/redis')
  return new Redis({ url: creds.url, token: creds.token })
}

export async function readPermitsSnapshot(): Promise<Permit[] | null> {
  try {
    const redis = await getRedis()
    if (!redis) return null
    const snap = await redis.get<PermitSnapshot>(PERMITS_KEY)
    if (!snap) return null
    if (Date.now() - snap.capturedAt > SNAPSHOT_MAX_AGE_MS) return null
    return snap.permits
  } catch (err) {
    console.error('Redis read failed', err)
    return null
  }
}

export async function writePermitsSnapshot(permits: Permit[]): Promise<void> {
  const redis = await getRedis()
  if (!redis) {
    throw new Error(
      'Upstash Redis not configured (missing UPSTASH_REDIS_REST_URL/TOKEN or KV_REST_API_URL/TOKEN)',
    )
  }
  const payload: PermitSnapshot = { capturedAt: Date.now(), permits }
  await redis.set(PERMITS_KEY, payload)
}

/**
 * Filter an in-memory permits array using the same rules as the server-side
 * recency clauses. Mirrors the SoQL filter so cached + live paths return the
 * same shape.
 */
export function filterPermits(
  all: Permit[],
  completedYears: number,
  recentActivityMonths: number,
): Permit[] {
  const now = new Date()
  const completedCutoff =
    completedYears > 0 ? yearsAgo(now, completedYears) : null
  const activityCutoff =
    recentActivityMonths > 0 ? monthsAgo(now, recentActivityMonths) : null

  const inactive = new Set([
    'cancelled', 'denied', 'disapproved', 'expired',
    'revoked', 'withdrawn', 'overruled', 'unknown',
  ])

  return all.filter((p) => {
    const status = (p.status ?? '').toLowerCase()
    const isInactive = inactive.has(status)
    const inProgress = !p.completed_date && !isInactive
    const recentlyCompleted =
      !!completedCutoff &&
      !!p.completed_date &&
      new Date(p.completed_date) >= completedCutoff
    if (!inProgress && !recentlyCompleted) return false
    if (activityCutoff) {
      const sd = p.status_date ? new Date(p.status_date) : null
      if (!sd || sd < activityCutoff) return false
    }
    return true
  })
}

function yearsAgo(now: Date, years: number): Date {
  const d = new Date(now)
  d.setFullYear(d.getFullYear() - years)
  return d
}

function monthsAgo(now: Date, months: number): Date {
  const d = new Date(now)
  d.setMonth(d.getMonth() - months)
  return d
}
