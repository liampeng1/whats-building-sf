'use client'
import { useEffect, useState } from 'react'

interface Article {
  title: string
  url: string
  source: string | null
  published: string | null
  highlighted?: boolean
  imageUrl?: string | null
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

  // Articles with images shown as a horizontal-scrolling renderings strip;
  // every article (with or without image) listed below as a compact text list.
  const withImages = articles.filter((a) => a.imageUrl)

  return (
    <div className="space-y-6">
      {withImages.length > 0 && (
        <div className="-mx-6 px-6">
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scroll-px-6">
            {withImages.map((a, i) => (
              <a
                key={`img-${a.url}-${i}`}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 w-64 snap-start group"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.imageUrl ?? ''}
                  alt={a.title}
                  loading="lazy"
                  className="w-64 h-44 object-cover rounded border border-paper-edge group-hover:border-ink transition-colors"
                />
                <div className="mt-1.5 text-xs text-ink leading-tight line-clamp-2">{a.title}</div>
                <div className="mt-0.5 text-[10px] uppercase tracking-wider text-construction font-semibold">
                  SF YIMBY · rendering
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      <ul className="space-y-3">
        {articles.map((a, i) => (
          <li
            key={`${a.url}-${i}`}
            className={a.highlighted ? 'pl-3 border-l-2 border-construction' : ''}
          >
            <a
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block group"
            >
              <span className="font-serif text-base text-ink group-hover:underline leading-tight block">
                {a.title}
              </span>
            </a>
            <div className="text-xs text-ink-faint mt-0.5 flex items-center gap-2 flex-wrap">
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
    </div>
  )
}
