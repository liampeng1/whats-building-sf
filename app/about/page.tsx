import type { Metadata } from 'next'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import {
  STAGE_LABELS,
  STAGE_COLORS,
  STAGE_DEFINITIONS,
  stageIconSvg,
  type PermitStage,
} from '@/lib/permit-style'

export const metadata: Metadata = {
  title: 'About',
  description:
    'How What\'s Building SF works — the data sources, the lifecycle stages, and the methodology behind every project on the map.',
}

const LIFECYCLE: PermitStage[] = ['filed', 'approved', 'permitted', 'construction', 'complete']

interface SourceLink {
  label: string
  href: string
  blurb: string
}

const DATA_SOURCES: SourceLink[] = [
  {
    label: 'DataSF · Building Permits',
    href: 'https://data.sfgov.org/Housing-and-Buildings/Building-Permits/i98e-djp9',
    blurb:
      'The canonical permit record, refreshed nightly by SF Department of Building Inspection. We pull every permit of type 1 (new construction) or 2 (new construction, wood-frame) — the slices that represent meaningful new buildings.',
  },
  {
    label: 'SF Planning · Development Pipeline',
    href: 'https://data.sfgov.org/Housing-and-Buildings/SF-Development-Pipeline/6jgi-cpb4',
    blurb:
      'Planning department\'s curated tracker of major projects with a current_status field that says whether construction is actually underway. We join this against the permit dataset and use it to escalate "Permitted" projects to "Construction" — the only ground-truth signal that physical work has started.',
  },
  {
    label: 'DataSF · Parcels (Active & Retired)',
    href: 'https://data.sfgov.org/Geographic-Locations-and-Boundaries/Parcels-Active-and-Retired/acdm-wktn',
    blurb:
      'Assessor parcel polygons keyed by block + lot. We fetch the polygon for the currently-selected permit and draw it on the map so the lot is visible underneath the marker.',
  },
  {
    label: 'DataSF · Analysis Neighborhoods',
    href: 'https://data.sfgov.org/Geographic-Locations-and-Boundaries/Analysis-Neighborhoods/p5b7-5n3h',
    blurb:
      "The 41-neighborhood definition the city uses for its own analytics. We render these as the choropleth at low zoom and as the panel context when you click into one.",
  },
  {
    label: 'DataSF · Zoning Districts',
    href: 'https://data.sfgov.org/Geographic-Locations-and-Boundaries/Zoning-Districts/3i4a-hu95',
    blurb:
      "Every parcel-level zoning district in SF — RH-1, NCT-3, RM-1, etc. We aggregate these into five general categories (Residential, Mixed Use, Commercial, Industrial, Public) for the zoning lens, but the drill-down rows show the specific districts within each.",
  },
  {
    label: 'DataSF · Height + Bulk Districts',
    href: 'https://data.sfgov.org/Geographic-Locations-and-Boundaries/Height-and-Bulk-Districts/aizk-9pid',
    blurb:
      "Maximum building height per parcel. Surfaced in zoning detail panels with numeric comparisons against city landmarks (a 40-ft cap is roughly four stories, etc.) so the limits feel concrete.",
  },
  {
    label: 'BART + Muni + Caltrain · 511.org regional GTFS',
    href: 'https://511.org/open-data/transit',
    blurb:
      "Bay Area's official GTFS feed. We pull station locations for BART, Muni Metro, Caltrain, plus stop locations for Muni's rapid-bus (R-suffix) lines and the SFMTA Frequent Transit Network. Used to build the transit tier polygons and the per-station walk-shed views.",
  },
  {
    label: 'MOHCD · Affordable Housing Pipeline',
    href: 'https://data.sfgov.org/Housing-and-Buildings/Affordable-Housing-Pipeline/aaxw-2cb8',
    blurb:
      "SF Mayor's Office of Housing & Community Development tracker of below-market-rate units. We join this against the permit dataset by block + lot to surface BMR counts in permit detail panels.",
  },
]

const REFERENCES: SourceLink[] = [
  {
    label: 'SF Department of Building Inspection',
    href: 'https://www.sf.gov/departments--department-building-inspection--permit-services-dbi',
    blurb: 'The agency that reviews plans and issues permits.',
  },
  {
    label: 'DBI Permit Tracking System',
    href: 'https://dbiweb02.sfgov.org/dbipts/',
    blurb: 'Live status lookup for any permit number — handy if you want to dive deeper than what we surface here.',
  },
  {
    label: 'AB-032: Site Permit Processing',
    href: 'https://codelibrary.amlegal.com/codes/san_francisco/f34d8cdf-0811-4e2d-8768-67a15f4b6738/sf_building/0-0-0-82311',
    blurb: 'The administrative bulletin describing SF\'s site-permit-and-addendum process — the reason "approved" and "permitted" are different stages here.',
  },
  {
    label: 'Building Permit Status Definitions (PermitPlace)',
    href: 'https://permitplace.com/building-permit-status-definitions/',
    blurb: 'Industry-standard definitions for the lifecycle terms used across most US permit systems.',
  },
]

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-paper">
      <div className="border-b-2 border-ink bg-paper-deep">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="civic-eyebrow hover:text-ink transition-colors">
            ← Back to map
          </Link>
          <div className="flex items-center gap-2 civic-eyebrow text-ink-faint">
            <Logo size={20} variant="on-paper" />
            <span>What&apos;s Building SF · About</span>
          </div>
        </div>
      </div>

      <article className="max-w-3xl mx-auto px-6 py-12 space-y-12">
        {/* Hero */}
        <header>
          <div className="civic-eyebrow mb-3">About</div>
          <h1 className="font-serif text-5xl text-ink leading-none tracking-tight mb-5">
            What&apos;s Building SF
          </h1>
          <p className="font-serif text-xl text-ink-soft leading-snug max-w-2xl">
            A live, nightly-refreshed map of every major new-construction permit
            in San Francisco — joined to SF Planning&apos;s Development Pipeline
            so you can tell which projects are actually being built, not just
            issued and sitting. View the city through three lenses:
            neighborhoods, zoning, and transit access.
          </p>

          {/* Three-up pitch — the differentiation, plain. */}
          <ul className="mt-8 grid sm:grid-cols-3 gap-6">
            <li className="border-t-2 border-ink pt-3">
              <div className="civic-eyebrow mb-1.5">Refreshed nightly</div>
              <p className="text-sm text-ink leading-snug">
                SF Planning&apos;s official Pipeline report comes out{' '}
                <a
                  href="https://sfplanning.org/project/pipeline-report"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-paper-edge underline-offset-2 hover:decoration-ink"
                >
                  once a quarter
                </a>
                . We pull from the same data source every night.
              </p>
            </li>
            <li className="border-t-2 border-ink pt-3">
              <div className="civic-eyebrow mb-1.5">Open data, no key</div>
              <p className="text-sm text-ink leading-snug">
                Every permit on the map is also available as{' '}
                <a
                  href="/api/public/permits.json"
                  className="underline decoration-paper-edge underline-offset-2 hover:decoration-ink"
                >
                  JSON
                </a>
                ,{' '}
                <a
                  href="/api/public/permits.csv"
                  className="underline decoration-paper-edge underline-offset-2 hover:decoration-ink"
                >
                  CSV
                </a>
                , or an{' '}
                <a
                  href="/feed.xml"
                  className="underline decoration-paper-edge underline-offset-2 hover:decoration-ink"
                >
                  Atom feed
                </a>
                . No login, no API key.
              </p>
            </li>
            <li className="border-t-2 border-ink pt-3">
              <div className="civic-eyebrow mb-1.5">Free + open source</div>
              <p className="text-sm text-ink leading-snug">
                Built as a civic-data side project. Source on{' '}
                <a
                  href="https://github.com/liampeng1/whats-building-sf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-paper-edge underline-offset-2 hover:decoration-ink"
                >
                  GitHub
                </a>
                ; suggestions and PRs welcome.
              </p>
            </li>
          </ul>
        </header>

        {/* Three lenses */}
        <section className="pt-8 border-t border-paper-edge">
          <div className="civic-eyebrow mb-4">Three lenses</div>
          <p className="text-ink-soft mb-6 leading-relaxed">
            The chip rail at the top of the map switches between three ways of
            slicing the city. Click any chip to open its directory of regions
            with cross-context. Click a region to drill in.
          </p>
          <dl className="space-y-5">
            <div className="flex gap-4">
              <span className="inline-flex shrink-0 mt-1 w-8 h-8 rounded-full bg-paper-deep items-center justify-center font-serif text-base font-bold text-ink">
                N
              </span>
              <div>
                <dt className="font-serif text-xl font-semibold leading-none mb-1.5 text-ink">
                  Neighborhoods
                </dt>
                <dd className="text-ink leading-relaxed">
                  The 41 SF Analysis Neighborhoods, ranked by 12-month permit
                  count. Each row carries a zoning-mix bar (% Residential vs
                  Mixed Use vs Commercial within the nhood), homes-added,
                  year-over-year change, median days-to-permit, and a
                  near-rail percentage. Search and sort A–Z if the ranking
                  isn&apos;t what you want.
                </dd>
              </div>
            </div>
            <div className="flex gap-4">
              <span className="inline-flex shrink-0 mt-1 w-8 h-8 rounded-full bg-paper-deep items-center justify-center font-serif text-base font-bold text-ink">
                Z
              </span>
              <div>
                <dt className="font-serif text-xl font-semibold leading-none mb-1.5 text-ink">
                  Zoning
                </dt>
                <dd className="text-ink leading-relaxed">
                  Five general-use categories — Residential, Mixed Use,
                  Commercial, Industrial, Public — with side-by-side bars for
                  &ldquo;% of SF land&rdquo; vs &ldquo;% of matching
                  permits.&rdquo; The story is in the gap: Mixed Use is ~8% of
                  the land and produces ~40% of the housing permits. Click
                  any category to expand its specific districts (RH-1, NCT-3,
                  RM-1, etc.) with their share of the category&apos;s land.
                </dd>
              </div>
            </div>
            <div className="flex gap-4">
              <span className="inline-flex shrink-0 mt-1 w-8 h-8 rounded-full bg-paper-deep items-center justify-center font-serif text-base font-bold text-ink">
                T
              </span>
              <div>
                <dt className="font-serif text-xl font-semibold leading-none mb-1.5 text-ink">
                  Transit
                </dt>
                <dd className="text-ink leading-relaxed">
                  Four mutually-exclusive tiers based on the nearest frequent
                  service within ¼ mile — <strong>Rail-served</strong> (BART,
                  Muni Metro, Caltrain), <strong>Rapid-bus only</strong>{' '}
                  (R-suffix Muni lines, no rail), <strong>Local-bus only</strong>{' '}
                  (frequent local Muni, no rapid or rail), and
                  <strong> Transit-poor</strong> (none of the above). The four
                  shares sum to 100% of SF&apos;s land.
                </dd>
              </div>
            </div>
          </dl>
        </section>

        {/* Lifecycle stages */}
        <section className="pt-8 border-t border-paper-edge">
          <div className="civic-eyebrow mb-4">Lifecycle stages</div>
          <p className="text-ink-soft mb-6 leading-relaxed">
            Every permit on the map sits in one of five stages. The most
            commonly-confused split — between <span className="font-semibold text-ink">Approved</span>{' '}
            and <span className="font-semibold text-ink">Permitted</span> — is a
            real distinction in SF, often months long, driven by the city&apos;s{' '}
            <a
              href="https://codelibrary.amlegal.com/codes/san_francisco/f34d8cdf-0811-4e2d-8768-67a15f4b6738/sf_building/0-0-0-82311"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-paper-edge underline-offset-2 hover:decoration-ink"
            >
              site-permit-and-addendum process
            </a>
            .
          </p>
          <dl className="space-y-5">
            {LIFECYCLE.map((stage) => {
              const color = STAGE_COLORS[stage].fill
              const label = STAGE_LABELS[stage].split(' / ')[0].split(' · ')[0]
              return (
                <div key={stage} className="flex gap-4">
                  <span
                    className="inline-flex shrink-0 mt-0.5"
                    style={{ width: 32, height: 32 }}
                    dangerouslySetInnerHTML={{ __html: stageIconSvg(stage, 32) }}
                  />
                  <div>
                    <dt className="font-serif text-xl font-semibold leading-none mb-1.5" style={{ color }}>
                      {label}
                    </dt>
                    <dd className="text-ink leading-relaxed">{STAGE_DEFINITIONS[stage]}</dd>
                  </div>
                </div>
              )
            })}
          </dl>
        </section>

        {/* Data sources */}
        <section className="pt-8 border-t border-paper-edge">
          <div className="civic-eyebrow mb-4">Data sources</div>
          <p className="text-ink-soft mb-6 leading-relaxed">
            Everything on the map comes from public San Francisco datasets.
            Click through to the canonical record on DataSF if you want to
            verify a number or build something of your own.
          </p>
          <ul className="space-y-5">
            {DATA_SOURCES.map((s) => (
              <li key={s.href}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-serif text-lg font-semibold text-ink underline decoration-paper-edge underline-offset-2 hover:decoration-ink"
                >
                  {s.label}
                </a>
                <p className="text-sm text-ink-soft leading-relaxed mt-1">{s.blurb}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Methodology */}
        <section className="pt-8 border-t border-paper-edge">
          <div className="civic-eyebrow mb-4">Methodology</div>
          <ul className="space-y-3 text-ink leading-relaxed list-disc pl-5 marker:text-ink-faint">
            <li>
              We track only{' '}
              <span className="font-semibold">building permits of type 1 (new construction)</span> and{' '}
              <span className="font-semibold">type 2 (new construction, wood-frame)</span>. Type 3 (additions / alterations / repairs) is excluded — it&apos;s dominated by minor remodels.
            </li>
            <li>
              <span className="font-semibold">Construction</span>
              {' '}is determined by SF Planning&apos;s Development Pipeline, not the permit&apos;s
              raw status field. An issued permit can sit for months before ground breaks;
              the Pipeline tells you when it actually does.
            </li>
            <li>
              When a permit lists multiple addresses (a parcel-merger project), the rows are deduped
              by permit number — DataSF returns one row per (permit, address), so naïve summing
              would multiply the home count.
            </li>
            <li>
              Demolition permits filed on the same parcel within 10 years of a construction permit
              are surfaced in the project timeline so you can see what was there before.
            </li>
            <li>
              The snapshot refreshes nightly at 07:00 UTC via a Vercel cron job that pulls the
              full tracked-type slice from DataSF and joins it against the Pipeline.
            </li>
            <li>
              <span className="font-semibold">Each permit gets a neighborhood</span> via
              point-in-polygon against the 41 Analysis Neighborhood shapes, computed
              server-side. That assignment drives the Neighborhoods directory&apos;s
              counts and the per-neighborhood detail panel.
            </li>
            <li>
              <span className="font-semibold">Transit tiers are mutually exclusive.</span>{' '}
              Every parcel in SF belongs to exactly one — Rail-served if a BART /
              Muni Metro / Caltrain station is within ¼ mi, otherwise Rapid-bus only
              (¼ mi from an R-line stop), otherwise Local-bus only (¼ mi from a
              Muni Frequent-Transit-Network stop), otherwise Transit-poor. The four
              tier polygons are clipped to the SF outline so the shares sum to 100%.
            </li>
            <li>
              <span className="font-semibold">Cross-stats are pre-computed at build time</span>{' '}
              using turf.js — every neighborhood&apos;s zoning mix, every zoning category&apos;s
              top neighborhoods, every neighborhood&apos;s % near rail. These are geometric
              and don&apos;t change between builds; the temporal data (permit counts, homes
              added, days-to-permit, YoY) comes from the daily snapshot via{' '}
              <a
                href="/api/lens-stats"
                className="underline decoration-paper-edge underline-offset-2 hover:decoration-ink"
              >
                <code>/api/lens-stats</code>
              </a>
              .
            </li>
            <li>
              <span className="font-semibold">Zoning detail panels include height context.</span>{' '}
              For a 40-ft district we show that limit alongside Victorian rowhouses and
              corner-store buildings for visual reference; for a 240-ft district we line
              it up against Salesforce Tower so the numbers feel concrete.
            </li>
          </ul>
        </section>

        {/* Further reading */}
        <section className="pt-8 border-t border-paper-edge">
          <div className="civic-eyebrow mb-4">Further reading</div>
          <ul className="space-y-4">
            {REFERENCES.map((s) => (
              <li key={s.href}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-ink underline decoration-paper-edge underline-offset-2 hover:decoration-ink"
                >
                  {s.label}
                </a>
                <p className="text-sm text-ink-soft leading-relaxed mt-1">{s.blurb}</p>
              </li>
            ))}
          </ul>
        </section>

        <footer className="pt-8 border-t border-paper-edge text-sm text-ink-faint">
          Built by Liam Peng. Free + open civic data, presented carefully.{' '}
          <Link href="/" className="text-ink hover:underline">
            Back to map
          </Link>
        </footer>
      </article>
    </main>
  )
}
