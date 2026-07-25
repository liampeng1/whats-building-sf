import { fetchBuildingPermits } from '@/lib/datasf'
import { computeActivity, MILESTONE_LABELS, type ActivityEvent } from '@/lib/activity'

/**
 * Atom feed of recent permit activity — new filings, approvals, permit
 * issuances, construction starts, and completions in one stream.
 *
 * Shares its "what counts as recent activity" logic with the on-site /activity
 * feed and homepage teaser via `computeActivity`, so all three stay in sync.
 * Entries are ordered newest-first (feed-reader convention) rather than by
 * significance.
 *
 * Cached for 6h on the edge (matches the snapshot-refresh cadence).
 */

export const revalidate = 21600

const SITE_URL = 'https://whatsbuildingsf.com'
const FEED_TITLE = "What's Building SF · recent activity"
const FEED_DESCRIPTION =
  'Recent activity across San Francisco new-construction permits — filings, approvals, issuances, construction starts, completions.'
const FEED_WINDOW_DAYS = 60
const MAX_ENTRIES = 50

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function eventToEntry(e: ActivityEvent): string {
  const p = e.permit
  const id = `${SITE_URL}/permits/${encodeURIComponent(p.permit_number)}`
  const homesPart = e.netHomes > 0 ? ` · +${e.netHomes} net new homes` : ''
  const title = `${p.address} · ${MILESTONE_LABELS[e.stage]}${homesPart}`
  const summary = [
    p.permit_type_definition ?? 'Building permit',
    'in San Francisco.',
    p.description ? `Scope: ${p.description}` : '',
  ]
    .filter(Boolean)
    .join(' ')
  const updated = new Date(e.eventDate).toISOString()
  const lat = p.location?.coordinates?.[1]
  const lng = p.location?.coordinates?.[0]
  const inMapUrl =
    lat != null && lng != null
      ? `${SITE_URL}/?lat=${lat}&lng=${lng}&permit=${encodeURIComponent(p.permit_number)}`
      : `${SITE_URL}/?permit=${encodeURIComponent(p.permit_number)}`
  return [
    '  <entry>',
    `    <id>${escapeXml(id)}</id>`,
    `    <title>${escapeXml(title)}</title>`,
    `    <link rel="alternate" href="${escapeXml(inMapUrl)}"/>`,
    `    <link rel="related" href="${escapeXml(id)}"/>`,
    `    <updated>${updated}</updated>`,
    `    <category term="${escapeXml(e.stage)}"/>`,
    `    <summary>${escapeXml(summary)}</summary>`,
    '  </entry>',
  ].join('\n')
}

export async function GET() {
  try {
    const permits = await fetchBuildingPermits(2, 0)
    // Shared derivation, then re-ordered newest-first for the feed reader.
    const recent = computeActivity(permits, Date.now(), { windowDays: FEED_WINDOW_DAYS })
      .sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime())
      .slice(0, MAX_ENTRIES)

    const lastUpdated = recent[0]?.eventDate
      ? new Date(recent[0].eventDate).toISOString()
      : new Date().toISOString()

    const entries = recent.map(eventToEntry).join('\n')

    const xml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(FEED_TITLE)}</title>
  <subtitle>${escapeXml(FEED_DESCRIPTION)}</subtitle>
  <link rel="self" href="${SITE_URL}/feed.xml"/>
  <link rel="alternate" href="${SITE_URL}/"/>
  <id>${SITE_URL}/</id>
  <updated>${lastUpdated}</updated>
  <author>
    <name>What's Building SF</name>
    <uri>${SITE_URL}</uri>
  </author>
${entries}
</feed>
`

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/atom+xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400',
      },
    })
  } catch (err) {
    console.error('feed.xml', err)
    return new Response('Failed to build feed\n', { status: 500 })
  }
}
