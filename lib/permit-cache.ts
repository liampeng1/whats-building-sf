/**
 * Daily-snapshot cache for the full permits dataset, backed by Vercel KV.
 *
 * Architecture:
 *   - A daily Vercel cron route fetches the *complete* tracked permits +
 *     pipeline statuses + assessor parcel IDs from DataSF and writes the
 *     full array as a single KV value under PERMITS_KEY.
 *   - Every API request reads that snapshot and filters in memory.
 *   - When KV isn't provisioned (no env vars) or the snapshot is missing,
 *     callers fall back to a live DataSF fetch — nothing breaks.
 *
 * KV is the Vercel-managed Redis-compatible store. On the Hobby tier our
 * usage stays well within the free quota (single ~1 MB blob, daily write,
 * one read per request).
 */

import type { Permit } from './types'

const PERMITS_KEY = 'permits:tracked-snapshot:v1'
const SNAPSHOT_MAX_AGE_MS = 48 * 60 * 60 * 1000 // 48h — even if cron stalls a day

interface PermitSnapshot {
  capturedAt: number
  permits: Permit[]
}

function isKvConfigured(): boolean {
  return !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN
}

/**
 * Returns the cached permits array if a fresh snapshot exists in KV.
 * Returns null when KV isn't configured, the snapshot is missing, or it's
 * stale beyond SNAPSHOT_MAX_AGE_MS.
 */
export async function readPermitsSnapshot(): Promise<Permit[] | null> {
  if (!isKvConfigured()) return null
  try {
    const { kv } = await import('@vercel/kv')
    const snap = await kv.get<PermitSnapshot>(PERMITS_KEY)
    if (!snap) return null
    if (Date.now() - snap.capturedAt > SNAPSHOT_MAX_AGE_MS) return null
    return snap.permits
  } catch (err) {
    console.error('KV read failed', err)
    return null
  }
}

export async function writePermitsSnapshot(permits: Permit[]): Promise<void> {
  if (!isKvConfigured()) {
    throw new Error('Vercel KV not configured (missing KV_REST_API_URL/KV_REST_API_TOKEN)')
  }
  const { kv } = await import('@vercel/kv')
  const payload: PermitSnapshot = { capturedAt: Date.now(), permits }
  await kv.set(PERMITS_KEY, payload)
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
