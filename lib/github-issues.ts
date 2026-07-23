// Thin wrapper over GitHub's "create an issue" REST endpoint. Uses the
// existing user-scoped GITHUB_FEEDBACK_TOKEN (shared with leoporady); the repo
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

  const data = (await resp.json()) as { html_url?: string; number: number }
  if (!data.html_url) throw new Error('GitHub response missing html_url')
  return { url: data.html_url, number: data.number }
}
