import Link from 'next/link'
import { notFound } from 'next/navigation'
import { fetchBuildingPermit, NotFoundError } from '@/lib/datasf'
import {
  permitStage,
  timeAgo,
  STAGE_COLORS,
  STAGE_LABELS,
  STAGE_SYMBOLS,
  type PermitStage,
} from '@/lib/permit-style'
import { RelatedSources } from '@/components/RelatedSources'
import { RelatedArticles } from '@/components/RelatedArticles'

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function formatCost(cost: string | null): string {
  if (!cost) return '—'
  const n = Number(cost)
  if (!Number.isFinite(n)) return cost
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function StatusBadge({ stage, completedDate }: { stage: PermitStage; completedDate: string | null }) {
  const color = STAGE_COLORS[stage].fill
  const label =
    stage === 'complete' && completedDate
      ? `Completed ${formatDate(completedDate)}`
      : STAGE_LABELS[stage]
  return (
    <div
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold"
      style={{ color, backgroundColor: `${color}15`, border: `1px solid ${color}40` }}
    >
      <span className="text-lg leading-none">{STAGE_SYMBOLS[stage]}</span>
      <span>{label}</span>
    </div>
  )
}

interface TimelineStep {
  label: string
  date: string | null
  active: boolean
}

function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol className="space-y-4">
      {steps.map((step, i) => (
        <li key={step.label} className="relative pl-6">
          {i < steps.length - 1 && (
            <span aria-hidden className="absolute left-[7px] top-4 bottom-[-1rem] w-px bg-paper-edge" />
          )}
          <span
            aria-hidden
            className={`absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full border-2 ${
              step.active ? 'bg-ink border-ink' : 'bg-paper border-paper-edge'
            }`}
          />
          <div className={`text-xs uppercase tracking-wider ${step.active ? 'text-ink' : 'text-ink-faint'}`}>
            {step.label}
          </div>
          <div className={`text-sm ${step.active ? 'text-ink font-medium' : 'text-ink-faint'}`}>
            {step.date ? formatDate(step.date) : 'Not yet'}
            {step.date && (
              <span className="text-ink-faint font-normal"> · {timeAgo(step.date)}</span>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}

export default async function PermitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let permit
  try {
    permit = await fetchBuildingPermit(id)
  } catch (error) {
    if (error instanceof NotFoundError) notFound()
    throw error
  }

  const coords = permit.location?.coordinates
  const backHref = coords ? `/?lat=${coords[1]}&lng=${coords[0]}` : '/'

  const stage = permitStage(permit.status)

  const timelineSteps: TimelineStep[] = [
    { label: 'Filed', date: permit.filed_date, active: !!permit.filed_date },
    { label: 'Issued', date: permit.issued_date, active: !!permit.issued_date },
    { label: 'Last activity', date: permit.status_date, active: !!permit.status_date && stage !== 'complete' },
    { label: 'Completed', date: permit.completed_date, active: !!permit.completed_date },
  ]

  return (
    <main className="min-h-screen bg-paper">
      {/* Masthead — full-bleed header strip */}
      <div className="border-b-2 border-ink bg-paper-deep">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href={backHref} className="civic-eyebrow hover:text-ink transition-colors">
            ← Back to map
          </Link>
          <div className="civic-eyebrow text-ink-faint">SF In Progress · Permit Record</div>
        </div>
      </div>

      <article className="max-w-3xl mx-auto px-6 py-10">
        {/* Dateline */}
        <div className="civic-eyebrow mb-3">
          Permit #{permit.permit_number}
        </div>

        {/* Address as masthead — large serif */}
        <h1 className="font-serif text-5xl text-ink leading-none tracking-tight mb-3">
          {permit.address}
        </h1>

        <p className="font-serif italic text-xl text-ink-soft mb-6">
          {permit.permit_type_definition ?? `Type ${permit.permit_type}`}
        </p>

        <StatusBadge stage={stage} completedDate={permit.completed_date} />

        {stage === 'construction' && (
          <p className="text-sm text-ink-soft mt-4 leading-relaxed border-l-2 border-paper-edge pl-4">
            Permit issued {timeAgo(permit.issued_date) ?? 'recently'}. DataSF doesn&apos;t publish
            formal completion estimates — the finish date isn&apos;t known until inspections sign off.
          </p>
        )}

        {/* Two-column body */}
        <div className="mt-10 grid md:grid-cols-3 gap-x-8 gap-y-8">
          {/* Left rail: facts */}
          <aside className="md:col-span-1 space-y-5">
            <div>
              <div className="civic-eyebrow mb-1.5">Estimated cost</div>
              <div className="font-serif text-2xl text-ink">{formatCost(permit.estimated_cost)}</div>
            </div>
            <div>
              <div className="civic-eyebrow mb-1.5">Status</div>
              <div className="text-sm text-ink">{permit.status}</div>
            </div>
            {coords && (
              <div>
                <div className="civic-eyebrow mb-1.5">Coordinates</div>
                <div className="text-sm text-ink-soft font-mono">
                  {coords[1].toFixed(5)}, {coords[0].toFixed(5)}
                </div>
              </div>
            )}
          </aside>

          {/* Right column: description + timeline */}
          <div className="md:col-span-2 space-y-8">
            {permit.description && (
              <section>
                <div className="civic-eyebrow mb-2">Scope of work</div>
                <p className="text-base text-ink leading-relaxed font-serif">
                  {permit.description}
                </p>
              </section>
            )}

            <section>
              <div className="civic-eyebrow mb-4">Timeline</div>
              <Timeline steps={timelineSteps} />
            </section>
          </div>
        </div>

        {/* Full-width news section */}
        <section className="mt-12 pt-8 border-t border-paper-edge">
          <div className="civic-eyebrow mb-4">In the news</div>
          <RelatedArticles address={permit.address} />
        </section>

        <section className="mt-10 pt-8 border-t border-paper-edge">
          <RelatedSources
            address={permit.address}
            lat={coords?.[1]}
            lng={coords?.[0]}
          />
        </section>

        <footer className="mt-12 pt-6 border-t border-paper-edge">
          <a
            href="https://data.sfgov.org/Housing-and-Buildings/Building-Permits/i98e-djp9"
            target="_blank"
            rel="noopener noreferrer"
            className="civic-eyebrow text-ink-faint hover:text-ink"
          >
            Source · DataSF Building Permits ↗
          </a>
        </footer>
      </article>
    </main>
  )
}
