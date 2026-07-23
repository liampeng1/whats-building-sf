// Files each suggestion-box submission as a GitHub issue. Guards, in order:
// honeypot (silent drop) → per-IP daily rate limit (fail-open) → validation.
// See docs/superpowers/specs/2026-07-22-analytics-and-suggestions-design.md.
import { NextRequest, NextResponse } from 'next/server'
import { parseSuggestion, toIssue } from '@/lib/suggestions'
import { createIssue } from '@/lib/github-issues'
import { rateLimit } from '@/lib/rate-limit'

const DAILY_LIMIT = 25
const DAY_SECONDS = 86_400

function clientIp(req: NextRequest): string {
  const real = req.headers.get('x-real-ip')?.trim()
  if (real) return real
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) {
    const hops = fwd.split(',').map((h) => h.trim()).filter(Boolean)
    if (hops.length) return hops[hops.length - 1]
  }
  return 'unknown'
}

export async function POST(req: NextRequest) {
  const raw = await req.json().catch(() => null)
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null

  // 1. Honeypot — bots fill the hidden `company` field. Fake success, drop it.
  if (obj && typeof obj.company === 'string' && obj.company.trim() !== '') {
    return NextResponse.json({ ok: true })
  }

  // 2. Rate limit (fails open if Redis is unavailable).
  const { ok } = await rateLimit(`suggest:rl:${clientIp(req)}`, DAILY_LIMIT, DAY_SECONDS)
  if (!ok) {
    return NextResponse.json({ ok: false, error: 'Daily limit reached' }, { status: 429 })
  }

  // 3. Validation.
  const suggestion = parseSuggestion(raw)
  if (!suggestion) {
    return NextResponse.json({ ok: false, error: 'Invalid suggestion' }, { status: 400 })
  }

  // 4. File the issue.
  try {
    const { url, number } = await createIssue(toIssue(suggestion))
    return NextResponse.json({ ok: true, url, number })
  } catch (err) {
    console.error('suggestions:', err)
    const missingToken =
      err instanceof Error && err.message.includes('GITHUB_FEEDBACK_TOKEN')
    return NextResponse.json(
      { ok: false, error: "Couldn't submit" },
      { status: missingToken ? 500 : 502 },
    )
  }
}
