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

  it('throws when the response is 2xx but has no html_url', async () => {
    process.env = { ...OLD_ENV, GITHUB_FEEDBACK_TOKEN: 'gho_test' }
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ number: 7 }),
    }) as unknown as typeof fetch
    await expect(createIssue(INPUT)).rejects.toThrow()
  })
})
