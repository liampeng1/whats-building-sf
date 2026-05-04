'use client'
import { useEffect, useState } from 'react'

interface Article {
  title: string
  url: string
  source: string | null
  published: string | null
  highlighted?: boolean
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

  if (error) return <div className="text-xs text-ink-faint">{error}</div>
  if (articles === null) return <div className="text-xs text-ink-faint italic">Searching news…</div>
  if (articles.length === 0) {
    return (
      <div className="text-sm text-ink-faint italic">
        No recent articles mention this address. Try the search links below.
      </div>
    )
  }

  return (
    <ul className="space-y-4">
      {articles.map((a, i) => (
        <li
          key={`${a.url}-${i}`}
          className={a.highlighted ? 'pl-3 border-l-2 border-construction' : ''}
        >
          <a
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-serif text-base text-ink hover:underline leading-tight block"
          >
            {a.title}
          </a>
          <div className="text-xs text-ink-faint mt-1 flex items-center gap-2 flex-wrap">
            {a.highlighted && (
              <span className="text-construction font-semibold tracking-wide uppercase text-[10px]">
                Tagged on SF YIMBY
              </span>
            )}
            <span>{a.source}</span>
            {a.published && (
              <>
                <span aria-hidden>·</span>
                <span>{formatPubDate(a.published)}</span>
              </>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
