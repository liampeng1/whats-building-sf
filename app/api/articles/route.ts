import { NextResponse } from 'next/server'
import { XMLParser } from 'fast-xml-parser'

export interface Article {
  title: string
  url: string
  source: string | null
  published: string | null
}

interface RssItem {
  title?: string
  link?: string
  pubDate?: string
  source?: string | { '#text'?: string; url?: string }
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, '').trim()
}

function parseSource(src: RssItem['source']): string | null {
  if (!src) return null
  if (typeof src === 'string') return src
  return src['#text'] ?? null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')
  if (!q) return NextResponse.json({ articles: [] })

  const query = `"${q}" San Francisco`
  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`

  try {
    const res = await fetch(rssUrl, {
      headers: { 'User-Agent': 'sf-in-progress/1.0' },
      next: { revalidate: 3600 },
    })
    if (!res.ok) throw new Error(`RSS error: ${res.status}`)

    const xml = await res.text()
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' })
    const parsed = parser.parse(xml) as { rss?: { channel?: { item?: RssItem | RssItem[] } } }
    const raw = parsed?.rss?.channel?.item ?? []
    const items: RssItem[] = Array.isArray(raw) ? raw : [raw]

    const articles: Article[] = items.slice(0, 10).map((item) => ({
      title: stripHtml(item.title ?? ''),
      url: item.link ?? '',
      source: parseSource(item.source),
      published: item.pubDate ?? null,
    }))

    return NextResponse.json({ articles })
  } catch (err) {
    console.error('articles fetch failed', err)
    return NextResponse.json({ articles: [], error: 'Could not load articles' }, { status: 500 })
  }
}
