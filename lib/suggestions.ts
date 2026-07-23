// Validation and GitHub-issue formatting for the suggestion box.
// Pure (no I/O) so the API route stays a thin transport layer and this is
// trivially unit-testable. Mirrors leoporady's lib/feedback.ts.

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
