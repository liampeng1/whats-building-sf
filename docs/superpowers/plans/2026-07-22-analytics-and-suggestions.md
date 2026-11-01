# Analytics + Suggestions Box Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Vercel Web Analytics and a site-wide suggestion box that files each submission as a GitHub issue in `liampeng1/whats-building-sf`.

**Architecture:** Analytics is a one-component mount in the root layout. The suggestion box is a client form (`SuggestForm`) surfaced two ways — a floating modal button (`SuggestButton`, mounted once in the layout) and an inline section on `/about`. It POSTs to `app/api/suggestions/route.ts`, a thin transport layer over three pure/near-pure libs: `lib/suggestions.ts` (validate + format), `lib/github-issues.ts` (create the issue), and `lib/rate-limit.ts` (per-IP daily cap via existing Upstash Redis). A hidden honeypot field drops bots.

**Tech Stack:** Next.js App Router (this repo's fork — see AGENTS.md), React client components, `@vercel/analytics`, `@upstash/redis` (already a dependency), GitHub REST API, Jest + React Testing Library.

## Global Constraints

- **Read the bundled Next.js docs before writing App Router code.** Per `AGENTS.md`, this is a modified Next.js; consult `node_modules/next/dist/docs/` and heed deprecations rather than relying on training data.
- **Reuse the existing token.** GitHub auth is `process.env.GITHUB_FEEDBACK_TOKEN` — the existing GitHub token with issue-creation access. Do **not** invent a new PAT or a `GITHUB_TOKEN`/`GITHUB_REPO` pair.
- **Repo target is a constant:** `liampeng1/whats-building-sf`.
- **Rate limit:** 25 submissions/day per IP. Fails **open** (allow) when Redis is unavailable.
- **Tests** live in `__tests__/`, use Jest globals (no import of `describe`/`it`/`expect`), and add `/** @jest-environment jsdom */` as the first line for component tests. Run one file with `npx jest <path>`.
- **Theme classes** already in the codebase: `bg-paper`, `bg-paper-deep`, `border-paper-edge`, `text-ink`, `text-ink-soft`, `text-ink-faint`, `bg-ink`, `bg-ink-soft`, `text-paper`. Match `components/CoffeeButton.tsx` / `components/FilterFAB.tsx` for floating controls.
- **Public issues:** submissions become public GitHub issues; length is capped, no further sanitization.
- Commit after every task with the shown message.

---

### Task 1: Vercel Web Analytics

**Files:**
- Modify: `package.json` (add dependency)
- Modify: `app/layout.tsx` (mount `<Analytics />`)

**Interfaces:**
- Produces: nothing consumed by later tasks (independent).

- [ ] **Step 1: Install the package**

Run:
```bash
npm install @vercel/analytics
```
Expected: `package.json` gains `"@vercel/analytics"` under `dependencies`; install succeeds.

- [ ] **Step 2: Mount `<Analytics />` in the root layout**

In `app/layout.tsx`, add the import near the other imports at the top:
```tsx
import { Analytics } from '@vercel/analytics/next';
```
Then render it inside `<body>`, immediately after `{children}`:
```tsx
      <body className="min-h-full flex flex-col bg-paper text-ink">
        {children}
        <Analytics />
      </body>
```

- [ ] **Step 3: Verify it typechecks and builds**

Run:
```bash
npx tsc --noEmit
```
Expected: no errors.

Run:
```bash
npm run build
```
Expected: build completes successfully (the `<Analytics />` component compiles into the layout).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json app/layout.tsx
git commit -m "feat: add Vercel Web Analytics"
```

> **Note for the owner (not a code step):** analytics only reports once **Web Analytics** is enabled in the Vercel project dashboard. The component is inert until then.

---

### Task 2: `lib/suggestions.ts` — validate + format (pure)

**Files:**
- Create: `lib/suggestions.ts`
- Test: `__tests__/suggestions.test.ts`

**Interfaces:**
- Produces:
  - `interface Suggestion { message: string; from?: string }`
  - `parseSuggestion(body: unknown): Suggestion | null`
  - `toIssue(s: Suggestion, now?: Date): { title: string; body: string; labels: string[] }`

- [ ] **Step 1: Write the failing test**

Create `__tests__/suggestions.test.ts`:
```ts
import { parseSuggestion, toIssue } from '@/lib/suggestions'

describe('parseSuggestion', () => {
  it('accepts and trims a plain message', () => {
    expect(parseSuggestion({ message: '  more bike lanes  ' })).toEqual({
      message: 'more bike lanes',
    })
  })
  it('keeps a trimmed non-empty "from"', () => {
    expect(parseSuggestion({ message: 'hi', from: '  Ada ' })).toEqual({
      message: 'hi',
      from: 'Ada',
    })
  })
  it('drops a blank "from"', () => {
    expect(parseSuggestion({ message: 'hi', from: '   ' })).toEqual({ message: 'hi' })
  })
  it.each([
    ['null body', null],
    ['missing message', {}],
    ['blank message', { message: '   ' }],
    ['non-string message', { message: 42 }],
    ['overlong message', { message: 'x'.repeat(2001) }],
    ['overlong from', { message: 'hi', from: 'y'.repeat(101) }],
    ['non-string from', { message: 'hi', from: 5 }],
  ])('rejects %s', (_label, body) => {
    expect(parseSuggestion(body)).toBeNull()
  })
})

describe('toIssue', () => {
  const now = new Date('2026-07-22T12:00:00.000Z')

  it('derives the title from the message and sets labels', () => {
    const issue = toIssue({ message: 'add dark mode' }, now)
    expect(issue.title).toBe('Suggestion: add dark mode')
    expect(issue.labels).toEqual(['suggestion', 'from-website'])
    expect(issue.body).toContain('add dark mode')
    expect(issue.body).toContain('Submitted: 2026-07-22T12:00:00.000Z')
  })
  it('truncates a long title to 60 chars with an ellipsis', () => {
    const msg = 'a'.repeat(80)
    const issue = toIssue({ message: msg }, now)
    expect(issue.title).toBe(`Suggestion: ${'a'.repeat(60)}…`)
  })
  it('includes "From:" only when a name is present', () => {
    expect(toIssue({ message: 'hi', from: 'Ada' }, now).body).toContain('From: Ada')
    expect(toIssue({ message: 'hi' }, now).body).not.toContain('From:')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/suggestions.test.ts`
Expected: FAIL — cannot find module `@/lib/suggestions`.

- [ ] **Step 3: Write the implementation**

Create `lib/suggestions.ts`:
```ts
// Validation and GitHub-issue formatting for the suggestion box.
// Pure (no I/O) so the API route stays a thin transport layer and this is
// trivially unit-testable. Mirrors a sibling project's lib/feedback.ts.

export interface Suggestion {
  message: string
  from?: string
}

const MESSAGE_MAX = 2000
const FROM_MAX = 100
const TITLE_MAX = 60

/** Parse an untrusted request body into a Suggestion, or null if invalid. */
export function parseSuggestion(body: unknown): Suggestion | null {
  if (typeof body !== 'object' || body === null) return null
  const { message, from } = body as Record<string, unknown>
  if (typeof message !== 'string') return null
  const msg = message.trim()
  if (!msg || msg.length > MESSAGE_MAX) return null
  if (from !== undefined) {
    if (typeof from !== 'string' || from.length > FROM_MAX) return null
    const f = from.trim()
    if (f) return { message: msg, from: f }
  }
  return { message: msg }
}

/** Shape a Suggestion into a GitHub issue payload. `now` is injected for tests. */
export function toIssue(
  s: Suggestion,
  now: Date = new Date(),
): { title: string; body: string; labels: string[] } {
  const head =
    s.message.length > TITLE_MAX ? `${s.message.slice(0, TITLE_MAX)}…` : s.message
  const lines = [s.message, '', '---']
  if (s.from) lines.push(`From: ${s.from}`)
  lines.push(`Submitted: ${now.toISOString()}`)
  lines.push("Filed from the What's Building SF suggestion box.")
  return {
    title: `Suggestion: ${head}`,
    body: lines.join('\n'),
    labels: ['suggestion', 'from-website'],
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/suggestions.test.ts`
Expected: PASS (all cases green).

- [ ] **Step 5: Commit**

```bash
git add lib/suggestions.ts __tests__/suggestions.test.ts
git commit -m "feat: suggestion validation + issue formatting"
```

---

### Task 3: `lib/github-issues.ts` — create the issue

**Files:**
- Create: `lib/github-issues.ts`
- Test: `__tests__/github-issues.test.ts`

**Interfaces:**
- Consumes: the `{ title, body, labels }` shape produced by `toIssue` (Task 2).
- Produces:
  - `interface IssueInput { title: string; body: string; labels: string[] }`
  - `createIssue(input: IssueInput): Promise<{ url: string; number: number }>`

- [ ] **Step 1: Write the failing test**

Create `__tests__/github-issues.test.ts`:
```ts
import { createIssue } from '@/lib/github-issues'

const INPUT = { title: 'Suggestion: hi', body: 'hi', labels: ['suggestion'] }

describe('createIssue', () => {
  const OLD_ENV = process.env
  afterEach(() => {
    process.env = OLD_ENV
    jest.restoreAllMocks()
  })

  it('throws when the token is missing', async () => {
    process.env = { ...OLD_ENV, GITHUB_FEEDBACK_TOKEN: '' }
    await expect(createIssue(INPUT)).rejects.toThrow('GITHUB_FEEDBACK_TOKEN')
  })

  it('POSTs to the repo and returns url + number on success', async () => {
    process.env = { ...OLD_ENV, GITHUB_FEEDBACK_TOKEN: 'gho_test' }
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        html_url: 'https://github.com/liampeng1/whats-building-sf/issues/7',
        number: 7,
      }),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    const result = await createIssue(INPUT)
    expect(result).toEqual({
      url: 'https://github.com/liampeng1/whats-building-sf/issues/7',
      number: 7,
    })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.github.com/repos/liampeng1/whats-building-sf/issues')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer gho_test')
    expect(JSON.parse(init.body)).toEqual(INPUT)
  })

  it('throws on a non-2xx GitHub response', async () => {
    process.env = { ...OLD_ENV, GITHUB_FEEDBACK_TOKEN: 'gho_test' }
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 403, json: async () => ({}) }) as unknown as typeof fetch
    await expect(createIssue(INPUT)).rejects.toThrow('403')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/github-issues.test.ts`
Expected: FAIL — cannot find module `@/lib/github-issues`.

- [ ] **Step 3: Write the implementation**

Create `lib/github-issues.ts`:
```ts
// Thin wrapper over GitHub's "create an issue" REST endpoint. Uses the
// existing GITHUB_FEEDBACK_TOKEN; the repo
// is a constant since this only ever files to one place.

const REPO = 'liampeng1/whats-building-sf'

export interface IssueInput {
  title: string
  body: string
  labels: string[]
}

/** Create a GitHub issue. Throws on missing token or a non-2xx response. */
export async function createIssue(
  input: IssueInput,
): Promise<{ url: string; number: number }> {
  const token = process.env.GITHUB_FEEDBACK_TOKEN
  if (!token) throw new Error('GITHUB_FEEDBACK_TOKEN is not set')

  const resp = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })
  if (!resp.ok) throw new Error(`GitHub responded ${resp.status}`)

  const data = (await resp.json()) as { html_url: string; number: number }
  return { url: data.html_url, number: data.number }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/github-issues.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/github-issues.ts __tests__/github-issues.test.ts
git commit -m "feat: createIssue GitHub REST wrapper"
```

---

### Task 4: `lib/rate-limit.ts` — per-IP daily cap (fail-open)

**Files:**
- Create: `lib/rate-limit.ts`
- Test: `__tests__/rate-limit.test.ts`

**Interfaces:**
- Produces: `rateLimit(key: string, limit: number, windowSeconds: number): Promise<{ ok: boolean; remaining: number }>`

- [ ] **Step 1: Write the failing test**

Create `__tests__/rate-limit.test.ts`:
```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/rate-limit.test.ts`
Expected: FAIL — cannot find module `@/lib/rate-limit`.

- [ ] **Step 3: Write the implementation**

Create `lib/rate-limit.ts`:
```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/rate-limit.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/rate-limit.ts __tests__/rate-limit.test.ts
git commit -m "feat: fail-open per-IP rate limiter"
```

---

### Task 5: `app/api/suggestions/route.ts` — the endpoint

**Files:**
- Create: `app/api/suggestions/route.ts`
- Test: `__tests__/api/suggestions.test.ts`

**Interfaces:**
- Consumes: `parseSuggestion`, `toIssue` (Task 2); `createIssue` (Task 3); `rateLimit` (Task 4).
- Produces: a `POST` handler. Responses: `200 { ok:true, url?, number? }`, `400`, `429`, `500`, `502`.

- [ ] **Step 1: Write the failing test**

Create `__tests__/api/suggestions.test.ts`:
```ts
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/suggestions/route'
import { createIssue } from '@/lib/github-issues'
import { rateLimit } from '@/lib/rate-limit'

jest.mock('@/lib/github-issues', () => ({ createIssue: jest.fn() }))
jest.mock('@/lib/rate-limit', () => ({ rateLimit: jest.fn() }))

const mockCreate = createIssue as jest.MockedFunction<typeof createIssue>
const mockRate = rateLimit as jest.MockedFunction<typeof rateLimit>

function post(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/suggestions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
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
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/api/suggestions.test.ts`
Expected: FAIL — cannot find module `@/app/api/suggestions/route`.

- [ ] **Step 3: Write the implementation**

Create `app/api/suggestions/route.ts`:
```ts
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
  const fwd = req.headers.get('x-forwarded-for')
  return fwd?.split(',')[0]?.trim() || 'unknown'
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/api/suggestions.test.ts`
Expected: PASS. (If `NextRequest` construction errors in the node env, confirm Node ≥18 so `Request`/`Response` globals exist; this repo already targets that.)

- [ ] **Step 5: Commit**

```bash
git add app/api/suggestions/route.ts __tests__/api/suggestions.test.ts
git commit -m "feat: /api/suggestions endpoint"
```

---

### Task 6: `components/SuggestForm.tsx` — the shared form

**Files:**
- Create: `components/SuggestForm.tsx`
- Test: `__tests__/SuggestForm.test.tsx`

**Interfaces:**
- Consumes: `POST /api/suggestions` (Task 5).
- Produces: `SuggestForm({ onDone }: { onDone?: () => void })` — a client component. Renders its own success/error/limited states.

- [ ] **Step 1: Write the failing test**

Create `__tests__/SuggestForm.test.tsx`:
```tsx
/** @jest-environment jsdom */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SuggestForm } from '@/components/SuggestForm'

describe('SuggestForm', () => {
  afterEach(() => jest.restoreAllMocks())

  it('submits and shows success with an issue link', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        url: 'https://github.com/liampeng1/whats-building-sf/issues/1',
      }),
    }) as unknown as typeof fetch

    render(<SuggestForm />)
    fireEvent.change(screen.getByLabelText(/your suggestion/i), {
      target: { value: 'add dark mode' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send suggestion/i }))

    await waitFor(() =>
      expect(screen.getByText(/suggestion filed/i)).toBeInTheDocument(),
    )
    expect(screen.getByRole('link', { name: /view it on github/i })).toHaveAttribute(
      'href',
      'https://github.com/liampeng1/whats-building-sf/issues/1',
    )
  })

  it('shows an error when the request fails', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 502, json: async () => ({}) }) as unknown as typeof fetch

    render(<SuggestForm />)
    fireEvent.change(screen.getByLabelText(/your suggestion/i), {
      target: { value: 'x' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send suggestion/i }))

    await waitFor(() => expect(screen.getByText(/couldn.t send/i)).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/SuggestForm.test.tsx`
Expected: FAIL — cannot find module `@/components/SuggestForm`.

- [ ] **Step 3: Write the implementation**

Create `components/SuggestForm.tsx`:
```tsx
'use client'

import { useState } from 'react'

type Status = 'idle' | 'sending' | 'sent' | 'error' | 'limited'

/**
 * Shared suggestion form. Rendered both inside the floating modal
 * (components/SuggestButton) and inline on /about. POSTs to /api/suggestions,
 * which files the submission as a GitHub issue.
 */
export function SuggestForm({ onDone }: { onDone?: () => void }) {
  const [message, setMessage] = useState('')
  const [from, setFrom] = useState('')
  const [company, setCompany] = useState('') // honeypot — humans leave blank
  const [status, setStatus] = useState<Status>('idle')
  const [issueUrl, setIssueUrl] = useState<string | null>(null)

  const send = async () => {
    if (!message.trim() || status === 'sending') return
    setStatus('sending')
    try {
      const resp = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, from: from.trim() || undefined, company }),
      })
      if (resp.status === 429) {
        setStatus('limited')
        return
      }
      if (!resp.ok) throw new Error(String(resp.status))
      const data = (await resp.json()) as { url?: string }
      setIssueUrl(data.url ?? null)
      setMessage('')
      setStatus('sent')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'sent') {
    return (
      <div className="text-sm text-ink">
        <p className="font-semibold">Thanks — suggestion filed. 🙏</p>
        {issueUrl && (
          <a
            href={issueUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink underline decoration-paper-edge underline-offset-2 hover:decoration-ink"
          >
            View it on GitHub
          </a>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        aria-label="Your suggestion"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={2000}
        rows={4}
        placeholder="What should we change or add?"
        className="text-sm text-ink bg-paper border border-paper-edge rounded-md p-2.5 resize-none outline-none focus:border-ink"
      />
      <input
        aria-label="Your name (optional)"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
        maxLength={100}
        placeholder="Your name (optional)"
        className="text-sm text-ink bg-paper border border-paper-edge rounded-md px-2.5 py-1.5 outline-none focus:border-ink"
      />
      {/* Honeypot: hidden from humans; bots that autofill it get dropped. */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        className="hidden"
      />
      {status === 'error' && (
        <p className="text-sm text-red-600">Couldn&apos;t send — try again.</p>
      )}
      {status === 'limited' && (
        <p className="text-sm text-ink-soft">
          You&apos;ve sent a lot of suggestions today — thanks! Try again tomorrow.
        </p>
      )}
      <div className="flex justify-end gap-2 pt-1">
        {onDone && (
          <button
            onClick={onDone}
            className="text-sm text-ink-soft hover:text-ink px-3 py-1.5 rounded-md border border-paper-edge hover:bg-paper-deep transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          onClick={send}
          disabled={!message.trim() || status === 'sending'}
          className="text-sm font-semibold bg-ink text-paper px-4 py-1.5 rounded-md hover:bg-ink-soft transition-colors disabled:opacity-50"
        >
          {status === 'sending' ? 'Sending…' : 'Send suggestion'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/SuggestForm.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/SuggestForm.tsx __tests__/SuggestForm.test.tsx
git commit -m "feat: shared SuggestForm component"
```

---

### Task 7: Surface it — floating button, layout mount, /about section, end-to-end check

**Files:**
- Create: `components/SuggestButton.tsx`
- Modify: `app/layout.tsx` (mount `<SuggestButton />`)
- Modify: `app/about/page.tsx` (embed `<SuggestForm />` section)
- Modify: `.env.local` (copy the existing token — local only, gitignored)

**Interfaces:**
- Consumes: `SuggestForm` (Task 6).
- Produces: `SuggestButton()` — a client component mounted once in the layout.

- [ ] **Step 1: Create the floating button + modal**

Create `components/SuggestButton.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { SuggestForm } from './SuggestForm'

/**
 * Floating "Suggest" pill, mounted once in the root layout so it appears on
 * every page. Opens a modal wrapping the shared <SuggestForm />. Positioned
 * above the map's FilterFAB (bottom-right, ~44px tall) so the two don't overlap.
 */
export function SuggestButton() {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-[1000] bg-paper border border-paper-edge rounded-md shadow-md px-3 py-2 text-xs font-medium text-ink-soft hover:text-ink hover:bg-paper-deep hover:border-ink transition-colors flex items-center gap-1.5"
        title="Suggest an idea"
      >
        <span aria-hidden>💡</span>
        <span>Suggest</span>
      </button>
    )
  }

  return (
    <div
      className="fixed inset-0 z-[2000] bg-black/50 grid place-items-center p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-md rounded-lg bg-paper border border-paper-edge shadow-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-ink mb-3">Suggestion box</h2>
        <SuggestForm onDone={() => setOpen(false)} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Mount it in the layout**

In `app/layout.tsx`, add the import:
```tsx
import { SuggestButton } from '@/components/SuggestButton';
```
Render it inside `<body>` after `{children}` (alongside `<Analytics />` from Task 1):
```tsx
      <body className="min-h-full flex flex-col bg-paper text-ink">
        {children}
        <SuggestButton />
        <Analytics />
      </body>
```

- [ ] **Step 3: Embed the form on /about**

In `app/about/page.tsx`, add the import near the top (with the other component imports):
```tsx
import { SuggestForm } from '@/components/SuggestForm'
```
Insert this section immediately **before** the closing `<footer …>` block:
```tsx
        {/* Suggestion box */}
        <section className="pt-8 border-t border-paper-edge">
          <div className="civic-eyebrow mb-4">Have an idea?</div>
          <p className="text-sm text-ink-soft leading-relaxed mb-4">
            Spotted something off, or want a feature? Send a suggestion — it goes
            straight to the project&apos;s issue tracker.
          </p>
          <SuggestForm />
        </section>
```

- [ ] **Step 4: Verify typecheck, tests, and build**

Run:
```bash
npx tsc --noEmit && npx jest && npm run build
```
Expected: typecheck clean, all suites pass, build succeeds.

- [ ] **Step 5: Copy the existing token into local env (gitignored)**

This lets the endpoint file a real issue during local verification. `.env.local` is gitignored (confirmed). This appends without printing the secret:
```bash
grep '^GITHUB_FEEDBACK_TOKEN=' <sibling-project>/.env.local >> <repo-root>/.env.local
```
Expected: `.env.local` now contains a `GITHUB_FEEDBACK_TOKEN=` line. Verify presence (not value):
```bash
grep -c '^GITHUB_FEEDBACK_TOKEN=' <repo-root>/.env.local
```
Expected: `1`.

- [ ] **Step 6: End-to-end manual verification**

Use the **`run`** skill (or `preview_start`) to launch the dev server, then:
1. Load `/` — confirm the "💡 Suggest" pill shows bottom-right and does **not** overlap the filter FAB or the coffee button.
2. Click it, type a test message, submit — expect "Thanks — suggestion filed" with a working GitHub link.
3. Confirm a new issue appears in `liampeng1/whats-building-sf` labeled `suggestion` + `from-website`. (Close the test issue afterward.)
4. Load `/about`, scroll to "Have an idea?", submit once more, confirm success.

> If the `suggestion` / `from-website` labels don't exist in the repo yet, GitHub still accepts the issue and creates the labels on first use — no manual setup needed.

- [ ] **Step 7: Commit**

```bash
git add components/SuggestButton.tsx app/layout.tsx app/about/page.tsx
git commit -m "feat: floating suggestion button + about-page form"
```

> `.env.local` is gitignored and is intentionally not committed.

---

## Post-implementation (owner, one-time, for production)

- Add the token to Vercel so the endpoint works in production:
  ```bash
  vercel env add GITHUB_FEEDBACK_TOKEN production
  vercel env add GITHUB_FEEDBACK_TOKEN preview
  ```
  (paste the same token value). Optional until the feature ships to prod.
- Enable **Web Analytics** in the Vercel project dashboard (Task 1).

## Self-Review notes

- **Spec coverage:** Analytics (Task 1); `SuggestForm` fields + honeypot + success/error (Task 6); floating button + `/about` placements (Task 7); API honeypot→rate-limit→validation→create ordering (Task 5); `lib/suggestions.ts` (Task 2), `lib/github-issues.ts` (Task 3), `lib/rate-limit.ts` (Task 4); token reuse + env handling (Task 7 + Post-implementation); all four test suites from the spec present.
- **Type consistency:** `createIssue`/`IssueInput` shape matches `toIssue`'s return; `rateLimit` return `{ ok, remaining }` used by the route; `SuggestForm` prop `onDone` matches `SuggestButton` usage.
- **No placeholders:** every code and test step is complete.
