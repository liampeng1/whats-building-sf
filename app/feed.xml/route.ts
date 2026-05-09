import { fetchBuildingPermits } from '@/lib/datasf'
import { permitStage, netDelta, STAGE_LABELS } from '@/lib/permit-style'

/**
 * Atom feed of recent permit activity. Surfaces the 50 most recently
 * status-stamped permits as feed entries — covers new filings, approvals,
 * issuances, breakings, and completions in one stream.
 *
 * Cached for 6h on the edge (matches the snapshot-refresh cadence).
 */

export const revalidate = 21600

const SITE_URL = 'https://whatsbuildingsf.com'
const FEED_TITLE = "What's Building SF · recent activity"
const FEED_DESCRIPTION =
  'Recent activity across San Francisco new-construction permits — filings, approvals, issuances, ground-breakings, completions.'

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function permitToEntry(p: import('@/lib/types').Permit): string | null {
  const date = p.status_date || p.issued_date || p.filed_date
  if (!date) return null
  const id = `${SITE_URL}/permits/${encodeURIComponent(p.permit_number)}`
  const stage = permitStage(p)
  const stageLabel = STAGE_LABELS[stage].split(' / ')[0].split(' · ')[0]
  const homes = netDelta(p.existing_units, p.proposed_units) ?? 0
  const homesPart = homes > 0 ? ` · +${homes} net new homes` : ''
  const title = `${p.address} · ${stageLabel}${homesPart}`
  const summary = [
    p.permit_type_definition ?? 'Building permit',
    'in San Francisco.',
    p.description ? `Scope: ${p.description}` : '',
  ]
    .filter(Boolean)
    .join(' ')
  const updated = new Date(date).toISOString()
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
    `    <category term="${escapeXml(stage)}"/>`,
    `    <summary>${escapeXml(summary)}</summary>`,
    '  </entry>',
  ].join('\n')
}

export async function GET() {
  try {
    const permits = await fetchBuildingPermits(2, 0)
    const recent = [...permits]
      .filter((p) => !!(p.status_date || p.issued_date || p.filed_date))
      .sort((a, b) => {
        const ad = a.status_date || a.issued_date || a.filed_date || ''
        const bd = b.status_date || b.issued_date || b.filed_date || ''
        return ad < bd ? 1 : -1
      })
      .slice(0, 50)
    const lastUpdated =
      recent[0]?.status_date || recent[0]?.issued_date || new Date().toISOString()

    const entries = recent
      .map(permitToEntry)
      .filter((s): s is string => s !== null)
      .join('\n')

    const xml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(FEED_TITLE)}</title>
  <subtitle>${escapeXml(FEED_DESCRIPTION)}</subtitle>
  <link rel="self" href="${SITE_URL}/feed.xml"/>
  <link rel="alternate" href="${SITE_URL}/"/>
  <id>${SITE_URL}/</id>
  <updated>${new Date(lastUpdated).toISOString()}</updated>
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
