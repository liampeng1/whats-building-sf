# Analytics + Suggestions Box — Design

**Date:** 2026-07-22
**Status:** Approved (pending spec review)

## Goal

Two independent additions to *What's Building SF*:

1. **Analytics** — know whether anyone besides the author is visiting the site.
2. **Suggestions box** — let visitors submit suggestions that become GitHub issues in
   `liampeng1/whats-building-sf`, triaged via labels.

The two parts share no code; they are specified together only because they were requested
together.

---

## Part A — Analytics (Vercel Web Analytics)

### Approach

Use `@vercel/analytics`. It is cookieless, privacy-friendly, requires no consent banner,
and reports to the existing Vercel dashboard.

### Changes

- Add `@vercel/analytics` to `dependencies`.
- Render `<Analytics />` from `@vercel/analytics/next` inside the `<body>` of
  `app/layout.tsx`.

### Manual setup (one-time, by the site owner)

- Enable **Web Analytics** in the Vercel project settings (dashboard toggle). Until this is
  on, the component is inert and no data is collected.

### Out of scope

- Custom event tracking. Only default pageview/visitor analytics.
- Speed Insights (separate package) — not requested.

---

## Part B — Suggestions box → GitHub issues

### Behavior

A visitor can open a form, type a suggestion, and submit. The submission creates a public
GitHub issue in `liampeng1/whats-building-sf`, labeled `suggestion` and `from-website`, left
open for the owner to triage. The visitor sees a confirmation with the new issue number.

### UI

Two placements, sharing one form component:

- **`components/SuggestButton.tsx`** (client component)
  - A floating "Suggest" button fixed in a screen corner, present on every page. Styled to
    match existing floating controls (`components/CoffeeButton.tsx`, `components/FilterFAB.tsx`).
  - Clicking opens a modal that renders `<SuggestForm />`.
  - Added once, in `app/layout.tsx`, so it appears site-wide.

- **`components/SuggestForm.tsx`** (client component)
  - Mirrors the field model of the existing leoporady suggestion box
    (`~/Projects/leoporady/components/FeedbackBox.tsx`): keep it minimal.
  - Fields:
    - **Message** — textarea, required, ≤ 2000 chars. The whole suggestion.
    - **Name** — single-line, optional, ≤ 100 chars ("Your name (optional)"). Lets the
      owner attribute/follow up.
    - **Honeypot** — a hidden field (`company`) visually removed and `aria-hidden`,
      `tabindex=-1`, `autocomplete=off`. Humans leave it blank; bots fill it.
  - The issue title is **derived** from the message (`Suggestion: <first 60 chars>…`), so
    there is no separate title field.
  - On submit: `POST /api/suggestions` with a JSON body. Disables the submit button while
    in flight.
  - Success → shows "Thanks — filed as issue #123" with a link to the issue.
  - Error → shows a friendly message; the rate-limit case (`429`) gets its own copy
    ("You've sent a lot of suggestions today — thanks! Try again tomorrow.").

- **`/about` page** — embeds the same `<SuggestForm />` as a section at the bottom of
  `app/about/page.tsx`.

### API — `app/api/suggestions/route.ts`

- `POST` handler, Node runtime (matches the rest of `app/api/`).
- Request body (JSON): `{ message, from?, company? }` where `company` is the honeypot.
- Processing order:
  1. **Honeypot** — if `company` is non-empty, return `200 { ok: true }` (fake success) and
     drop the request. Do not create an issue.
  2. **Rate limit** — key `suggest:rl:<ip>` in Upstash Redis, `INCR` with a 24h TTL set on
     first increment, cap **25 per day per IP**. Over the cap → `429`. If Redis is
     unreachable, **fail open** (allow) — the honeypot and GitHub still bound abuse. IP is
     read from `x-forwarded-for` (first hop) with a fallback constant when absent.
  3. **Validation** — trim; require non-empty `message`; enforce the length caps above. On
     failure → `400 { ok: false, error }`.
  4. **Create issue** — build `{ title, body, labels }` from the parsed submission (title
     derived from message; body = message + optional `from` + timestamp; labels
     `["suggestion", "from-website"]`) and pass to `lib/github-issues.ts`. On success →
     `200 { ok: true, url, number }`. On GitHub failure → `502 { ok: false, error }`.
- No secrets or IPs are ever returned to the client.

### Supporting libs

- **`lib/suggestions.ts`** (pure — no I/O, mirrors leoporady's `lib/feedback.ts`)
  - `parseSuggestion(body: unknown): Suggestion | null` — validates/trims; returns
    `{ message, from? }` or `null`. Enforces `message` non-empty and ≤ 2000, `from` ≤ 100.
  - `toIssue(s: Suggestion): { title: string; body: string; labels: string[] }` — derives
    `title` (`Suggestion: <first 60 chars>…`), composes `body` (message + optional
    `From: <name>` + submission timestamp), labels `["suggestion", "from-website"]`.
  - Kept pure so it is trivially unit-testable and the route stays a thin transport layer.

- **`lib/github-issues.ts`**
  - `createIssue({ title, body, labels }): Promise<{ url: string; number: number }>`
  - Reads `GITHUB_FEEDBACK_TOKEN` from env (the **existing** user-scoped `gho_` OAuth token
    already used by the leoporady project — works across the owner's repos, so no new token
    is created). Repo target is the constant `liampeng1/whats-building-sf`. Throws a clear
    error if the token is missing.
  - Calls `POST https://api.github.com/repos/{owner}/{repo}/issues` with
    `Authorization: Bearer <token>`, `Accept: application/vnd.github+json`,
    `X-GitHub-Api-Version: 2022-11-28`. Throws on non-2xx; returns
    `{ url: html_url, number }` on success.

- **`lib/rate-limit.ts`**
  - `rateLimit(key, limit, windowSeconds): Promise<{ ok: boolean; remaining: number }>`
  - Uses the same `@upstash/redis` dynamic-import + `getRedisCreds()` pattern already in
    `lib/permit-cache.ts` (read `UPSTASH_REDIS_REST_URL`/`KV_REST_API_URL` etc.).
  - `INCR` the key; if the returned count is 1, set `EXPIRE` to `windowSeconds`. Returns
    `ok: false` once count exceeds `limit`. If Redis creds are absent or the call throws,
    returns `ok: true` (fail open).

### Environment variables (no new provisioning required)

- `GITHUB_FEEDBACK_TOKEN` — the **existing** `gho_` OAuth token already used by leoporady.
  User-scoped, so it can create issues on `whats-building-sf` with no new PAT.
  - **Local:** copied into this project's `.env.local` during implementation (from the
    leoporady `.env.local`). Nothing for the owner to do.
  - **Production:** the same var must exist in the Vercel project. Set once via
    `vercel env add GITHUB_FEEDBACK_TOKEN` (Production + Preview) — the only owner-facing
    step, and optional until the feature ships to prod.
- Repo target is a hardcoded constant (`liampeng1/whats-building-sf`) — not an env var.
- Upstash Redis creds — already present in the project; reused as-is.

### Error handling summary

| Condition            | Response                        | User-facing result                     |
|----------------------|---------------------------------|----------------------------------------|
| Honeypot filled      | `200 { ok: true }`              | Fake success (bot dropped silently)    |
| Over rate limit      | `429 { ok: false, error }`      | "Lots of suggestions today — thanks!"  |
| Empty / too long     | `400 { ok: false, error }`      | Inline validation message              |
| GitHub API failure   | `502 { ok: false, error }`      | "Couldn't submit — please try again"   |
| Missing token        | `500` (logged), generic error   | "Couldn't submit — please try again"   |
| Success              | `200 { ok: true, url, number }` | "Thanks — filed as issue #123" + link  |

### Testing (Jest + React Testing Library, matching existing setup)

- `lib/suggestions.ts` — pure unit tests: `parseSuggestion` accepts valid, rejects
  empty/oversized/wrong-type, drops blank `from`; `toIssue` derives title, composes body,
  sets labels.
- `lib/github-issues.ts` — mocked `fetch`: builds the correct request; success returns
  `{ url, number }`; non-2xx throws; missing env throws.
- `lib/rate-limit.ts` — mocked Redis: allows under cap, blocks over cap, sets TTL on first
  hit, fails open when creds absent.
- `app/api/suggestions/route.ts` — honeypot drop (no issue created), validation rejects,
  rate-limit `429`, happy path returns issue url (suggestions/GitHub/Redis mocked).
- `components/SuggestForm.tsx` — submits and renders success; renders error on failure.

### Explicitly out of scope (YAGNI)

- Private moderation queue — submissions go straight to **public** issues (accepted
  trade-off).
- Categories/tags chosen by the user, file uploads, editing/withdrawing a submission.
- CAPTCHA / Turnstile — rate-limit + honeypot judged sufficient for this site.
- Email notifications beyond GitHub's own issue notifications.

## Security & privacy notes

- Submitted text lands in a **public** GitHub issue body. Length is capped and trimmed; no
  further sanitization is promised. This is inherent and intended.
- The GitHub token stays server-side only, never shipped to the client.
- Visitor IPs are used transiently as a rate-limit key (hashed key form `suggest:rl:<ip>`)
  and are not stored elsewhere or returned to clients.
