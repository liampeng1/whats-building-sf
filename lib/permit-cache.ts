/**
 * Daily-snapshot cache for the full permits dataset, backed by Upstash Redis
 * (provisioned via Vercel Marketplace; replaces the sunset @vercel/kv).
 *
 * Architecture:
 *   - A daily Vercel cron route fetches the *complete* tracked permits +
 *     pipeline statuses + assessor parcel IDs from DataSF and writes the
 *     full array into Redis as a meta-record + N chunks (Upstash Hobby tier
 *     caps single requests at 10 MB; the full ~16K-permit blob is ~11 MB).
 *   - Every API request reads the meta + chunks, filters in memory.
 *   - When Upstash isn't provisioned (env vars missing) or the snapshot is
 *     missing, callers fall back to a live DataSF fetch — nothing breaks.
 */

import type { Permit } from './types'

const META_KEY = 'permits:snap:v2:meta'
const CHUNK_PREFIX = 'permits:snap:v2:chunk:'
const CHUNK_SIZE = 5000 // ~3-4 MB per chunk in JSON; safely under Upstash's 10MB request cap
const SNAPSHOT_MAX_AGE_MS = 48 * 60 * 60 * 1000

interface SnapshotMeta {
  capturedAt: number
  chunkCount: number
  totalCount: number
}

function getRedisCreds(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN
  if (!url || !token) return null
  return { url, token }
}

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
    const meta = await redis.get<SnapshotMeta>(META_KEY)
    if (!meta) return null
    if (Date.now() - meta.capturedAt > SNAPSHOT_MAX_AGE_MS) return null

    // Read all chunks in parallel.
    const keys = Array.from({ length: meta.chunkCount }, (_, i) => `${CHUNK_PREFIX}${i}`)
    const chunks = await Promise.all(keys.map((k) => redis.get<Permit[]>(k)))
    const merged: Permit[] = []
    for (const c of chunks) {
      if (Array.isArray(c)) merged.push(...c)
    }
    if (merged.length === 0) return null
    return merged
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

  const chunks: Permit[][] = []
  for (let i = 0; i < permits.length; i += CHUNK_SIZE) {
    chunks.push(permits.slice(i, i + CHUNK_SIZE))
  }

  // Write chunks first, then meta last so a partial write never advertises
  // a chunkCount that doesn't fully exist yet. Old v1 keys (if any) age
  // out naturally; not worth a separate cleanup pass.
  await Promise.all(
    chunks.map((chunk, i) => redis.set(`${CHUNK_PREFIX}${i}`, chunk)),
  )
  const meta: SnapshotMeta = {
    capturedAt: Date.now(),
    chunkCount: chunks.length,
    totalCount: permits.length,
  }
  await redis.set(META_KEY, meta)
}

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
