import { NextResponse } from 'next/server'
import { XMLParser } from 'fast-xml-parser'

export interface Article {
  title: string
  url: string
  source: string | null
  published: string | null
  highlighted?: boolean
  imageUrl?: string | null
}

interface RssItem {
  title?: string
  link?: string
  pubDate?: string
  source?: string | { '#text'?: string; url?: string }
}

interface WpPost {
  title?: { rendered?: string }
  link?: string
  date?: string
  _embedded?: {
    'wp:featuredmedia'?: Array<{
      source_url?: string
      media_details?: {
        sizes?: Record<string, { source_url?: string; width?: number }>
      }
    }>
  }
}

function extractFeaturedImage(post: WpPost): string | null {
  const media = post._embedded?.['wp:featuredmedia']?.[0]
  if (!media) return null
  // Prefer a medium-sized version when available — full-size renderings can be huge.
  const sizes = media.media_details?.sizes
  if (sizes) {
    const preferred = sizes.medium_large ?? sizes.large ?? sizes.medium ?? sizes.full
    if (preferred?.source_url) return preferred.source_url
  }
  return media.source_url ?? null
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, '').trim()
}

function parseSource(src: RssItem['source']): string | null {
  if (!src) return null
  if (typeof src === 'string') return src
  return src['#text'] ?? null
}

async function fetchGoogleNews(q: string): Promise<Article[]> {
  const query = `"${q}" San Francisco`
  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`
  try {
    const res = await fetch(rssUrl, {
      headers: { 'User-Agent': 'whats-building-sf/1.0' },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    const xml = await res.text()
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' })
    const parsed = parser.parse(xml) as { rss?: { channel?: { item?: RssItem | RssItem[] } } }
    const raw = parsed?.rss?.channel?.item ?? []
    const items: RssItem[] = Array.isArray(raw) ? raw : [raw]
    return items.slice(0, 10).map((item) => ({
      title: stripHtml(item.title ?? ''),
      url: item.link ?? '',
      source: parseSource(item.source),
      published: item.pubDate ?? null,
    }))
  } catch (err) {
    console.error('google news fetch failed', err)
    return []
  }
}

async function fetchSfYimby(q: string): Promise<Article[]> {
  // SF YIMBY runs WordPress and exposes the standard REST API. They don't tag
  // posts by street address, but full-text search hits address strings in
  // titles/content reliably. Featured images on SF YIMBY posts are typically
  // architectural renderings of the project — gold for "show me what this
  // building will look like."
  const url = `https://sfyimby.com/wp-json/wp/v2/posts?search=${encodeURIComponent(q)}&per_page=5&_embed=wp:featuredmedia&_fields=title,link,date,_links,_embedded`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'whats-building-sf/1.0' },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    const posts: WpPost[] = await res.json()
    return posts.map((p) => ({
      title: stripHtml(p.title?.rendered ?? ''),
      url: p.link ?? '',
      source: 'SF YIMBY',
      published: p.date ?? null,
      highlighted: true,
      imageUrl: extractFeaturedImage(p),
    }))
  } catch (err) {
    console.error('sf yimby fetch failed', err)
    return []
  }
}

function dedupe(articles: Article[]): Article[] {
  const seen = new Set<string>()
  const out: Article[] = []
  for (const a of articles) {
    const key = a.url || a.title
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(a)
  }
  return out
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')
  if (!q) return NextResponse.json({ articles: [] })

  const [yimby, news] = await Promise.all([fetchSfYimby(q), fetchGoogleNews(q)])

  // SF YIMBY first (high signal for SF construction), then Google News for breadth.
  const articles = dedupe([...yimby, ...news])

  return NextResponse.json({ articles })
}
