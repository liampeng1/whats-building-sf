import type { Metadata } from 'next'
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { fetchBuildingPermits } from '@/lib/datasf'
import { computeStats, computeNeighborhoodStats } from '@/lib/stats'
import {
  STAGE_LABELS,
  STAGE_COLORS,
  stageIconSvg,
  type PermitStage,
} from '@/lib/permit-style'

export const metadata: Metadata = {
  title: 'Permit Purgatory · The numbers',
  description:
    "Median permit-processing times, stalled-project leaderboard, RHNA progress, and pipeline conversion rates for San Francisco. The report the city doesn't publish.",
}

// Re-validate every 6 hours — the underlying snapshot refreshes nightly via
// the cron route, so this is mostly for cache-warming.
export const revalidate = 21600

function fmt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toLocaleString('en-US')
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(0)}%`
}

function StatCard({
  eyebrow,
  value,
  detail,
  accent,
}: {
  eyebrow: string
  value: string
  detail?: string
  accent?: boolean
}) {
  return (
    <div className="border-t-2 border-ink pt-3">
      <div className="civic-eyebrow mb-1.5">{eyebrow}</div>
      <div
        className={`font-serif text-4xl leading-none tracking-tight ${
          accent ? 'text-construction' : 'text-ink'
        }`}
      >
        {value}
      </div>
      {detail && <div className="text-xs text-ink-soft mt-1.5 leading-snug">{detail}</div>}
    </div>
  )
}

function YearBar({
  year,
  count,
  homes,
  max,
}: {
  year: number
  count: number
  homes: number
  max: number
}) {
  const pct = max > 0 ? (count / max) * 100 : 0
  return (
    <div className="grid grid-cols-[3rem_1fr_auto] gap-3 items-center text-sm">
      <span className="font-serif text-ink tabular-nums">{year}</span>
      <span className="relative h-3 bg-paper-deep rounded">
        <span
          className="absolute inset-y-0 left-0 rounded"
          style={{ width: `${pct}%`, backgroundColor: '#9a4a31', opacity: 0.85 }}
        />
      </span>
      <span className="text-ink-soft text-xs tabular-nums">
        {fmt(count)} permits · +{fmt(homes)} homes
      </span>
    </div>
  )
}

async function loadNhoodGeo() {
  try {
    const buf = await fs.readFile(
      path.join(process.cwd(), 'public', 'sf-neighborhoods.geojson'),
      'utf8',
    )
    return JSON.parse(buf) as FeatureCollection<MultiPolygon | Polygon, { nhood: string }>
  } catch {
    return null
  }
}

export default async function StatsPage() {
  // Pull a wide window of permits so historical conversion / yearly stats
  // are accurate. completedYears=20 gives us essentially everything we have.
  const [permits, nhoodGeo] = await Promise.all([
    fetchBuildingPermits(20, 0),
    loadNhoodGeo(),
  ])
  const s = computeStats(permits)
  const nhoodStats = nhoodGeo ? computeNeighborhoodStats(permits, nhoodGeo) : []
  const topNhoods = nhoodStats.filter((r) => r.active > 0).slice(0, 12)
  const nhoodMaxPipeline = Math.max(1, ...topNhoods.map((r) => r.unitsInPipeline))

  const conversionRate = (n: number) => (s.conversionFiledCount > 0 ? n / s.conversionFiledCount : 0)
  const filedToPermitted = conversionRate(s.conversionReachedPermitted)
  const filedToConstruction = conversionRate(s.conversionReachedConstruction)
  const filedToComplete = conversionRate(s.conversionReachedComplete)

  const rhnaPct = s.rhnaUnitsDelivered / s.rhnaTarget
  const rhnaPace =
    s.rhnaCurrentAnnualPace > 0
      ? s.rhnaCurrentAnnualPace / s.rhnaRequiredAnnual
      : 0

  const yearMax = Math.max(1, ...s.filingsByYear.map((r) => r.count))

  const pipelineStages: PermitStage[] = [
    'filed',
    'approved',
    'permitted',
    'construction',
    'complete',
  ]
  const stageCountMap = new Map(s.byStage.map((r) => [r.stage, r] as const))
  const maxStage = Math.max(1, ...s.byStage.filter((r) => r.stage !== 'inactive').map((r) => r.count))

  return (
    <main className="min-h-screen bg-paper">
      <div className="border-b-2 border-ink bg-paper-deep">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="civic-eyebrow hover:text-ink transition-colors">
            ← Back to map
          </Link>
          <div className="flex items-center gap-2 civic-eyebrow text-ink-faint">
            <Logo size={20} variant="on-paper" />
            <span>What&apos;s Building SF · Stats</span>
          </div>
        </div>
      </div>

      <article className="max-w-3xl mx-auto px-6 py-12 space-y-12">
        {/* Hero */}
        <header>
          <div className="civic-eyebrow mb-3">Permit purgatory</div>
          <h1 className="font-serif text-5xl text-ink leading-none tracking-tight mb-5">
            The numbers behind SF&apos;s pipeline.
          </h1>
          <p className="font-serif text-xl text-ink-soft leading-snug max-w-2xl">
            Median permit-processing time, the longest-stalled approved
            projects, year-over-year filings, and how SF&apos;s housing delivery
            tracks against its{' '}
            <a
              href="https://abag.ca.gov/our-work/housing/rhna-regional-housing-needs-allocation"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-paper-edge underline-offset-2 hover:decoration-ink"
            >
              82,069-unit
            </a>{' '}
            state-mandated target. Computed nightly from the same data the
            Planning Department uses, served live instead of in a quarterly PDF.
          </p>
        </header>

        {/* Top-line cards */}
        <section id="snapshot">
          <div className="civic-eyebrow mb-4">Right now</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-6">
            <StatCard
              eyebrow="Tracked permits"
              value={fmt(s.totalTracked)}
              detail="Type 1 & 2 (new construction)"
            />
            <StatCard
              eyebrow="Units in pipeline"
              value={fmt(s.totalUnitsInPipeline)}
              detail="Active permits, all stages"
              accent
            />
            <StatCard
              eyebrow="Under construction"
              value={fmt(s.underConstruction)}
              detail={`${fmt(s.unitsUnderConstruction)} units, per SF Pipeline`}
            />
            <StatCard
              eyebrow="Completed (last 2y)"
              value={fmt(s.completedLast2y)}
              detail={`${fmt(s.unitsCompletedLast2y)} units finished`}
            />
          </div>
        </section>

        {/* Filed → issued time distribution */}
        <section id="timing" className="pt-8 border-t border-paper-edge">
          <div className="civic-eyebrow mb-4">How long does a permit take?</div>
          <p className="text-ink-soft mb-6 leading-relaxed">
            For permits that have made it from filing to issuance, this is the
            actual elapsed time. The median is half-faster, half-slower; the
            p90 is what you should expect if your project is in the long tail.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-6">
            <StatCard
              eyebrow="Median days"
              value={fmt(s.filedToIssuedMedian)}
              detail="Filed → permit issued"
              accent
            />
            <StatCard
              eyebrow="90th percentile"
              value={fmt(s.filedToIssuedP90)}
              detail="The slow tail"
            />
            <StatCard
              eyebrow="Sample size"
              value={fmt(s.filedToIssuedSampleSize)}
              detail="Issued permits in window"
            />
          </div>
          <p className="text-xs text-ink-faint mt-4 italic leading-snug">
            For context: the SF Examiner reports SF&apos;s 280-day median across
            <em> all </em>building-permit categories ranks behind Austin, Denver,
            Seattle, San Diego, and DC. The number above is for new-construction
            permits specifically.
          </p>
        </section>

        {/* Pipeline conversion rates */}
        <section id="conversion" className="pt-8 border-t border-paper-edge">
          <div className="civic-eyebrow mb-4">Where do they end up?</div>
          <p className="text-ink-soft mb-6 leading-relaxed">
            Of every permit filed in {s.conversionCohortYears[0]}–{s.conversionCohortYears[1]} —
            old enough to have had time to progress — what fraction reached each
            stage by today? {fmt(s.conversionFiledCount)} permits in the cohort.
          </p>
          <ul className="space-y-3">
            {[
              { label: 'Reached "permitted" stage or beyond', pct: filedToPermitted },
              { label: 'Reached construction or beyond', pct: filedToConstruction },
              { label: 'Reached complete', pct: filedToComplete },
            ].map((row) => (
              <li key={row.label} className="grid grid-cols-[1fr_auto] items-center gap-3">
                <div className="relative h-6 bg-paper-deep rounded overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0"
                    style={{
                      width: `${(row.pct * 100).toFixed(1)}%`,
                      backgroundColor: '#7d9b76',
                      opacity: 0.85,
                    }}
                  />
                  <div className="relative px-3 text-xs text-ink leading-6">
                    {row.label}
                  </div>
                </div>
                <span className="font-serif text-xl tabular-nums text-ink">
                  {fmtPct(row.pct)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Stalled */}
        {s.stalled.length > 0 && (
          <section id="purgatory" className="pt-8 border-t border-paper-edge">
            <div className="civic-eyebrow mb-4">Permit purgatory</div>
            <p className="text-ink-soft mb-6 leading-relaxed">
              Approved or permitted projects with no recent change of state in
              over a year. Some are waiting on financing, some on construction
              starts, some on legal challenges. None are obviously building.
            </p>
            <ol className="space-y-2">
              {s.stalled.map((row, i) => {
                const stageColor = STAGE_COLORS[row.stage].fill
                const stageLabel = STAGE_LABELS[row.stage]
                  .split(' / ')[0]
                  .split(' · ')[0]
                return (
                  <li key={row.permit.permit_number}>
                    <Link
                      href={`/?permit=${encodeURIComponent(row.permit.permit_number)}`}
                      className="grid grid-cols-[2rem_1fr_auto_auto] gap-3 items-center hover:bg-paper-deep rounded px-2 py-2 transition-colors"
                    >
                      <span className="font-serif text-ink-faint text-lg tabular-nums">
                        {i + 1}
                      </span>
                      <span className="font-serif text-ink text-lg leading-tight truncate">
                        {row.permit.address}
                      </span>
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide"
                        style={{
                          color: stageColor,
                          backgroundColor: `${stageColor}1f`,
                          border: `1px solid ${stageColor}`,
                        }}
                      >
                        <span
                          className="inline-flex w-3 h-3"
                          dangerouslySetInnerHTML={{ __html: stageIconSvg(row.stage, 12) }}
                        />
                        {stageLabel}
                      </span>
                      <span className="font-serif text-ink tabular-nums text-sm whitespace-nowrap">
                        {fmt(row.daysInStage)} d
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ol>
          </section>
        )}

        {/* Neighborhood velocity */}
        {topNhoods.length > 0 && (
          <section id="neighborhoods" className="pt-8 border-t border-paper-edge">
            <div className="civic-eyebrow mb-4">Where SF is actually building</div>
            <p className="text-ink-soft mb-6 leading-relaxed">
              Active permits and units in the pipeline by neighborhood.
              Sorted by units-in-pipeline — the count of net new homes
              currently making their way through filed → approved → permitted →
              construction. Tap any row to see the projects on the map.
            </p>
            <ol className="space-y-2">
              {topNhoods.map((row, i) => {
                const widthPct = (row.unitsInPipeline / nhoodMaxPipeline) * 100
                return (
                  <li key={row.nhood}>
                    <Link
                      href={`/?nhood=${encodeURIComponent(row.nhood)}`}
                      className="grid grid-cols-[2rem_1fr_auto] gap-3 items-center hover:bg-paper-deep rounded px-2 py-2 transition-colors"
                    >
                      <span className="font-serif text-ink-faint text-lg tabular-nums">
                        {i + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-serif text-ink text-base leading-tight truncate">
                          {row.nhood}
                        </span>
                        <span className="relative h-2 mt-1.5 bg-paper-deep rounded">
                          <span
                            className="absolute inset-y-0 left-0 rounded"
                            style={{
                              width: `${widthPct}%`,
                              backgroundColor: '#9a4a31',
                              opacity: 0.85,
                            }}
                          />
                        </span>
                      </span>
                      <span className="text-right text-xs whitespace-nowrap">
                        <span className="font-serif text-ink text-lg tabular-nums">
                          +{fmt(row.unitsInPipeline)}
                        </span>
                        <span className="block text-[10px] text-ink-faint uppercase tracking-wider mt-0.5">
                          {fmt(row.active)} permits ·{' '}
                          {fmt(row.underConstruction)} building
                        </span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ol>
          </section>
        )}

        {/* RHNA progress */}
        <section id="rhna" className="pt-8 border-t border-paper-edge">
          <div className="civic-eyebrow mb-4">RHNA progress · 2023 – 2031</div>
          <p className="text-ink-soft mb-6 leading-relaxed">
            San Francisco&apos;s Regional Housing Needs Allocation requires{' '}
            <span className="font-semibold text-ink">{fmt(s.rhnaTarget)}</span>{' '}
            new units between 2023 and 2031 — about{' '}
            <span className="font-semibold text-ink">
              {fmt(Math.round(s.rhnaRequiredAnnual))}
            </span>{' '}
            per year. Below: completions in our snapshot since the cycle began.
            (Total only — affordability tier breakdown ships with MOHCD BMR
            integration.)
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-6">
            <StatCard
              eyebrow="Delivered"
              value={fmt(s.rhnaUnitsDelivered)}
              detail={`${fmtPct(rhnaPct)} of cycle target`}
              accent
            />
            <StatCard
              eyebrow="Required annual"
              value={fmt(Math.round(s.rhnaRequiredAnnual))}
              detail="Units / year to hit 82,069 by 2031"
            />
            <StatCard
              eyebrow="Current annual pace"
              value={fmt(Math.round(s.rhnaCurrentAnnualPace))}
              detail={`${fmtPct(rhnaPace)} of required`}
            />
          </div>
          <div className="mt-6 relative h-6 bg-paper-deep rounded overflow-hidden">
            <div
              className="absolute inset-y-0 left-0"
              style={{
                width: `${Math.min(100, rhnaPct * 100).toFixed(2)}%`,
                backgroundColor: '#9a4a31',
                opacity: 0.9,
              }}
            />
            <div className="relative px-3 text-xs text-ink leading-6">
              {fmt(s.rhnaUnitsDelivered)} of {fmt(s.rhnaTarget)}
            </div>
          </div>
        </section>

        {/* Year-over-year filings */}
        {s.filingsByYear.length > 0 && (
          <section id="yoy" className="pt-8 border-t border-paper-edge">
            <div className="civic-eyebrow mb-4">Filings by year</div>
            <p className="text-ink-soft mb-6 leading-relaxed">
              New-construction permit applications filed each calendar year.
              Captures the front of the pipeline — what&apos;s arriving at DBI,
              not what&apos;s coming out the other end.
            </p>
            <div className="space-y-2">
              {s.filingsByYear.map((r) => (
                <YearBar
                  key={r.year}
                  year={r.year}
                  count={r.count}
                  homes={r.homes}
                  max={yearMax}
                />
              ))}
            </div>
          </section>
        )}

        {/* Pipeline mix */}
        <section id="mix" className="pt-8 border-t border-paper-edge">
          <div className="civic-eyebrow mb-4">Pipeline mix</div>
          <p className="text-ink-soft mb-6 leading-relaxed">
            Where every tracked permit sits today. Inactive (cancelled / expired
            / withdrawn) is excluded from the headline count above.
          </p>
          <ul className="space-y-2">
            {pipelineStages.map((stage) => {
              const row = stageCountMap.get(stage)
              if (!row) return null
              const color = STAGE_COLORS[stage].fill
              const label = STAGE_LABELS[stage].split(' / ')[0].split(' · ')[0]
              const widthPct = (row.count / maxStage) * 100
              return (
                <li
                  key={stage}
                  className="grid grid-cols-[1.5rem_5rem_1fr_auto] items-center gap-3 text-sm"
                >
                  <span
                    className="inline-flex w-5 h-5 shrink-0"
                    dangerouslySetInnerHTML={{ __html: stageIconSvg(stage, 18) }}
                  />
                  <span className="text-ink-soft text-xs uppercase tracking-wide">
                    {label}
                  </span>
                  <span
                    className="h-3 rounded"
                    style={{
                      width: `${widthPct}%`,
                      backgroundColor: color,
                      opacity: 0.7,
                    }}
                  />
                  <span className="font-serif text-ink tabular-nums text-base">
                    {fmt(row.count)}
                    <span className="text-ink-faint text-xs ml-1">
                      · +{fmt(row.homes)}
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        </section>

        {/* Footer */}
        <footer className="pt-8 border-t border-paper-edge text-sm text-ink-soft leading-relaxed">
          <p>
            All numbers computed nightly from{' '}
            <a
              href="https://data.sfgov.org/Housing-and-Buildings/Building-Permits/i98e-djp9"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-paper-edge hover:decoration-ink"
            >
              DataSF Building Permits
            </a>{' '}
            joined to{' '}
            <a
              href="https://data.sfgov.org/Housing-and-Buildings/SF-Development-Pipeline/6jgi-cpb4"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-paper-edge hover:decoration-ink"
            >
              SF Planning&apos;s Development Pipeline
            </a>
            . Permit type filter: 1 (new construction) and 2 (new construction,
            wood-frame). Read the{' '}
            <Link href="/about" className="underline decoration-paper-edge hover:decoration-ink">
              full methodology
            </Link>
            , or grab the{' '}
            <a
              href="/api/public/permits.json"
              className="underline decoration-paper-edge hover:decoration-ink"
            >
              JSON
            </a>{' '}
            /{' '}
            <a
              href="/api/public/permits.csv"
              className="underline decoration-paper-edge hover:decoration-ink"
            >
              CSV
            </a>
            .
          </p>
        </footer>
      </article>
    </main>
  )
}
