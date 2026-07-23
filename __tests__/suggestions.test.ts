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
