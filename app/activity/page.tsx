import type { Metadata } from 'next'
import Link from 'next/link'
import type { Polygon, MultiPolygon } from 'geojson'
import { Logo } from '@/components/Logo'
import { ActivityList, type ParcelMap } from '@/components/ActivityList'
import { fetchBuildingPermits, fetchParcelShape } from '@/lib/datasf'
import { computeActivity, type ActivityEvent } from '@/lib/activity'

export const metadata: Metadata = {
  title: "What's Building SF · Latest activity",
  description:
    'What just changed across San Francisco construction — permits just filed, approved, construction just started, and buildings just completed. Refreshed daily from DataSF.',
}

// The underlying snapshot refreshes nightly; revalidate every 6 hours.
export const revalidate = 21600

// How many days back the feed reaches. Kept generous so significance ranking
// always has enough notable projects to surface (big filings are rare).
const WINDOW_DAYS = 30
// Feed length. Also bounds the per-parcel DataSF lookups below.
const FEED_LIMIT = 48

// Fetch each event's assessor-parcel geometry (cached 24h per parcel) so the
// feed can render a map snippet of the lot. Best-effort: a missing parcel just
// falls back to a stage dot.
async function loadParcels(events: ActivityEvent[]): Promise<ParcelMap> {
  const entries = await Promise.all(
    events.map(async (e): Promise<[string, Polygon | MultiPolygon] | null> => {
      const { block, lot, permit_number } = e.permit
      if (!block || !lot) return null
      const shape = await fetchParcelShape(block, lot)
      return shape ? [permit_number, shape] : null
    }),
  )
  return Object.fromEntries(entries.filter((x): x is [string, Polygon | MultiPolygon] => x !== null))
}

export default async function ActivityPage() {
  // Recent activity only needs recently-dated permits; a 2-year completed
  // window plus all active permits comfortably covers a 30-day feed.
  const permits = await fetchBuildingPermits(2, 0)
  const now = Date.now()
  const events = computeActivity(permits, now, { windowDays: WINDOW_DAYS, limit: FEED_LIMIT })
  const parcels = await loadParcels(events)

  return (
    <main className="min-h-screen bg-paper">
      <div className="border-b-2 border-ink bg-paper-deep">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="civic-eyebrow hover:text-ink transition-colors">
            ← Back to map
          </Link>
          <div className="flex items-center gap-2 civic-eyebrow text-ink-faint">
            <Logo size={20} variant="on-paper" />
            <span>What&apos;s Building SF · Latest</span>
          </div>
        </div>
      </div>

      <article className="max-w-3xl mx-auto px-6 py-12">
        <header className="mb-8">
          <div className="civic-eyebrow mb-3">Latest activity</div>
          <h1 className="font-serif text-5xl text-ink leading-none tracking-tight mb-5">
            What just changed.
          </h1>
          <p className="font-serif text-xl text-ink-soft leading-snug max-w-2xl">
            Permits just filed, just approved, construction just started, and
            buildings just completed across San Francisco — ranked so the
            projects that matter rise to the top. Refreshed daily from{' '}
            <a
              href="https://data.sfgov.org"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-paper-edge underline-offset-2 hover:decoration-ink"
            >
              DataSF
            </a>
            . Also available as an{' '}
            <a
              href="/feed.xml"
              className="underline decoration-paper-edge underline-offset-2 hover:decoration-ink"
            >
              Atom feed
            </a>
            .
          </p>
        </header>

        <ActivityList events={events} now={now} parcels={parcels} />
      </article>
    </main>
  )
}
