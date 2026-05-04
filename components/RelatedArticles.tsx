'use client'
import { useEffect, useState } from 'react'

interface Article {
  title: string
  url: string
  source: string | null
  published: string | null
}

function formatPubDate(s: string | null): string | null {
  if (!s) return null
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function RelatedArticles({ address }: { address: string }) {
  const [articles, setArticles] = useState<Article[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(`/api/articles?q=${encodeURIComponent(address)}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('fetch failed'))))
      .then((data: { articles: Article[] }) => setArticles(data.articles ?? []))
      .catch((err: Error) => {
        if (err.name === 'AbortError') return
        setError('Could not load articles.')
      })
    return () => ctrl.abort()
  }, [address])

  if (error) return <div className="text-xs text-gray-400">{error}</div>
  if (articles === null) return <div className="text-xs text-gray-400">Searching news…</div>
  if (articles.length === 0) {
    return (
      <div className="text-xs text-gray-400">
        No recent articles mention this address. Try the search links below.
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {articles.map((a, i) => (
        <li key={`${a.url}-${i}`} className="text-sm">
          <a
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-700 hover:underline font-medium"
          >
            {a.title}
          </a>
          <div className="text-xs text-gray-500 mt-0.5">
            {a.source}
            {a.source && a.published ? ' · ' : ''}
            {formatPubDate(a.published)}
          </div>
        </li>
      ))}
    </ul>
  )
}
