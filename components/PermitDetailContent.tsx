import {
  permitStage,
  timeAgo,
  stageIconSvg,
  useCategory,
  netDelta,
  USE_CATEGORY_LABELS,
  USE_CATEGORY_COLORS,
  STAGE_COLORS,
  STAGE_LABELS,
  type PermitStage,
  type UseCategory,
} from '@/lib/permit-style'
import type { Permit } from '@/lib/types'
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

// Chip styling matches the legend's ON state (FilterPanel) so the entire
// site speaks one chip language: tinted fill (#color1f) + 1.5px solid
// colored border + colored text/glyph.
function StatusBadge({ stage, completedDate }: { stage: PermitStage; completedDate: string | null }) {
  const color = STAGE_COLORS[stage].fill
  const label =
    stage === 'complete' && completedDate
      ? `Completed ${formatDate(completedDate)}`
      : STAGE_LABELS[stage]
  return (
    <div
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold"
      style={{ color, backgroundColor: `${color}1f`, border: `1.5px solid ${color}` }}
    >
      <span className="inline-flex" dangerouslySetInnerHTML={{ __html: stageIconSvg(stage, 18) }} />
      <span>{label}</span>
    </div>
  )
}

function UseTypePill({ category }: { category: UseCategory }) {
  const color = USE_CATEGORY_COLORS[category].fill
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{
        color,
        backgroundColor: `${color}1f`,
        border: `1.5px solid ${color}`,
      }}
    >
      <span
        className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      {USE_CATEGORY_LABELS[category]}
    </span>
  )
}

function DeltaBlock({ label, before, after, suffix }: { label: string; before: string | null; after: string | null; suffix: string }) {
  const delta = netDelta(before, after)
  const beforeNum = before != null ? Number(before) : null
  const afterNum = after != null ? Number(after) : null
  const showBefore = beforeNum != null && Number.isFinite(beforeNum)
  const showAfter = afterNum != null && Number.isFinite(afterNum)
  if (!showBefore && !showAfter) return null
  const sign = delta != null && delta > 0 ? '+' : ''
  return (
    <div>
      <div className="civic-eyebrow mb-1.5">{label}</div>
      <div className="font-serif text-3xl text-ink leading-none">
        {showBefore ? beforeNum : 0} <span className="text-ink-faint">→</span>{' '}
        <span className="text-construction">{showAfter ? afterNum : 0}</span>
      </div>
      {delta != null && delta !== 0 && (
        <div className="text-xs text-ink-soft mt-1">{sign}{delta} {suffix}</div>
      )}
    </div>
  )
}

interface TimelineStep {
  label: string
  date: string | null
  active: boolean
  detail?: string
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
            {step.date && <span className="text-ink-faint font-normal"> · {timeAgo(step.date)}</span>}
          </div>
          {step.detail && (
            <div className="text-xs text-ink-soft mt-0.5">{step.detail}</div>
          )}
        </li>
      ))}
    </ol>
  )
}

interface Props {
  permit: Permit
  variant?: 'page' | 'panel'
  bmr?: import('@/lib/mohcd').BmrRow | null
}

function BmrBadge({ bmr }: { bmr: import('@/lib/mohcd').BmrRow }) {
  // Two visual variants: 100% affordable gets a stronger sage chip; mixed-
  // income inclusionary projects get the lighter amber-toned chip.
  if (bmr.is_fully_affordable) {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
        style={{
          color: '#3a6e58',
          backgroundColor: '#3a6e581f',
          border: '1.5px solid #3a6e58',
        }}
        title={`${bmr.mohcd_affordable_units} of ${bmr.total_project_units} units affordable`}
      >
        <span aria-hidden>★</span>
        100% affordable
      </span>
    )
  }
  if (bmr.mohcd_affordable_units > 0) {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
        style={{
          color: '#9a4a31',
          backgroundColor: '#9a4a311f',
          border: '1.5px solid #9a4a31',
        }}
        title={`${bmr.mohcd_affordable_units} below-market-rate of ${bmr.total_project_units} units`}
      >
        {bmr.mohcd_affordable_units} BMR · {bmr.affordable_percent ?? '—'}%
      </span>
    )
  }
  return null
}

export function PermitDetailContent({ permit, variant = 'page', bmr = null }: Props) {
  const stage = permitStage(permit)
  const category = useCategory(permit.proposed_use ?? permit.existing_use)
  const unitsDelta = netDelta(permit.existing_units, permit.proposed_units)
  const storiesDelta = netDelta(permit.existing_stories, permit.proposed_stories)
  const coords = permit.location?.coordinates

  // Compare two date strings by their day component only — DataSF often
  // stamps status_date with the same day as completed_date / issued_date,
  // and we don't want to show 'Last activity' as a separate timeline row
  // when it's redundant with another step.
  const sameDay = (a: string | null, b: string | null): boolean => {
    if (!a || !b) return false
    return a.slice(0, 10) === b.slice(0, 10)
  }
  const lastActivityRedundant =
    sameDay(permit.status_date, permit.completed_date) ||
    sameDay(permit.status_date, permit.issued_date) ||
    sameDay(permit.status_date, permit.filed_date)

  // What happened at "last activity" = the current status. Phrase it as
  // a human-readable detail so the date isn't context-free.
  const statusVerb = permit.status === 'complete' ? null : `Status set to "${permit.status}"`

  // One row per demolition permit. Use completed_date when available
  // (better signal — proves the demo actually happened), otherwise fall
  // back to filed_date. The sublabel surfaces the other date plus status.
  const demoSteps: TimelineStep[] = []
  for (const d of permit.demolitions ?? []) {
    const isComplete = d.status === 'complete' && !!d.completed_date
    const primaryDate = isComplete ? d.completed_date : d.filed_date
    if (!primaryDate) continue
    const label = isComplete ? 'Demolition complete' : 'Demolition filed'
    const otherDate =
      isComplete && d.filed_date
        ? `filed ${formatDate(d.filed_date)}`
        : !isComplete && d.completed_date
          ? `completed ${formatDate(d.completed_date)}`
          : null
    const detailParts = [`Permit #${d.permit_number}`, `status ${d.status}`]
    if (otherDate) detailParts.push(otherDate)
    demoSteps.push({
      label,
      date: primaryDate,
      active: true,
      detail: detailParts.join(' · '),
    })
  }
  demoSteps.sort((a, b) => {
    const ad = a.date ? new Date(a.date).getTime() : 0
    const bd = b.date ? new Date(b.date).getTime() : 0
    return ad - bd
  })

  const pipelineStep: TimelineStep | null =
    permit.pipeline_status &&
    permit.pipeline_status_date &&
    !sameDay(permit.pipeline_status_date, permit.status_date)
      ? {
          label: 'SF Planning update',
          date: permit.pipeline_status_date,
          active: true,
          detail: `Pipeline classification: "${permit.pipeline_status}"`,
        }
      : null

  // Lifecycle order: Filed → Issued → Last activity → SF Planning update → Completed.
  // Each step represents a phase; "Not yet" placeholders are kept so users see
  // the full pipeline even when a permit hasn't reached every stage.
  const allSteps: TimelineStep[] = [
    ...demoSteps,
    { label: 'Filed', date: permit.filed_date, active: !!permit.filed_date },
    { label: 'Issued', date: permit.issued_date, active: !!permit.issued_date },
    {
      label: 'Last activity',
      date: permit.status_date,
      active: !!permit.status_date && stage !== 'complete',
      detail: statusVerb ?? undefined,
    },
    ...(pipelineStep ? [pipelineStep] : []),
    { label: 'Completed', date: permit.completed_date, active: !!permit.completed_date },
  ]

  // Drop the redundant Last activity step when its date matches another.
  const filtered = allSteps.filter(
    (s) => !(s.label === 'Last activity' && lastActivityRedundant),
  )

  // For inactive (cancelled/withdrawn/etc) permits, the "Not yet" lifecycle
  // placeholders are misleading — those stages will never happen. Drop them.
  const showsPlaceholders = stage !== 'inactive'
  const dated = filtered.filter((s) => s.date)
  const undated = showsPlaceholders ? filtered.filter((s) => !s.date) : []

  // Strictly chronological for dated events, with future-stage placeholders
  // appended at the end in their natural lifecycle order.
  dated.sort((a, b) => {
    const ad = a.date ? new Date(a.date).getTime() : 0
    const bd = b.date ? new Date(b.date).getTime() : 0
    return ad - bd
  })
  const steps = [...dated, ...undated]

  const isPanel = variant === 'panel'
  const headingSize = isPanel ? 'text-3xl' : 'text-5xl'
  // Page variant fans the four stats out across 4 columns on wide screens;
  // panel stays at 2 cols regardless. One shape, two viewports.
  const statGridCols = isPanel ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4'
  const useDistinct =
    !!permit.existing_use &&
    !!permit.proposed_use &&
    permit.existing_use.toLowerCase() !== permit.proposed_use.toLowerCase()

  return (
    <div>
      <div className="civic-eyebrow mb-3">Permit #{permit.permit_number}</div>

      <h1 className={`font-serif ${headingSize} text-ink leading-none tracking-tight mb-3`}>
        {permit.address}
      </h1>

      <p className="font-serif italic text-lg text-ink-soft mb-5">
        {permit.permit_type_definition ?? `Type ${permit.permit_type}`}
      </p>

      {/* Chip strip — stage + use type. Both pulled into the same row so the
          masthead reads like an article header (lede + tags), no sidebar. */}
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge stage={stage} completedDate={permit.completed_date} />
        <UseTypePill category={category} />
        {bmr && <BmrBadge bmr={bmr} />}
      </div>

      {/* Quick narrative summary — only when there's something to summarize.
          Replaces the previous ChangeHeadline by leaning on the chip row +
          the stat strip for the structured data. */}
      {(unitsDelta || storiesDelta || useDistinct) && (
        <p className="text-sm text-ink-soft mt-3 leading-relaxed">
          {[
            unitsDelta && unitsDelta !== 0
              ? `${unitsDelta > 0 ? '+' : ''}${unitsDelta} ${Math.abs(unitsDelta) === 1 ? 'home' : 'homes'}`
              : null,
            storiesDelta && storiesDelta !== 0
              ? `${storiesDelta > 0 ? '+' : ''}${storiesDelta} ${Math.abs(storiesDelta) === 1 ? 'story' : 'stories'}`
              : null,
            useDistinct ? `${permit.existing_use} → ${permit.proposed_use}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}

      {stage === 'construction' && (
        <p className="text-sm text-ink-soft mt-4 leading-relaxed border-l-2 border-paper-edge pl-4">
          {permit.pipeline_status === 'Construction' ? (
            <>
              SF Planning&apos;s Development Pipeline marks this project as <strong>under construction</strong>
              {permit.pipeline_status_date
                ? ` since ${formatDate(permit.pipeline_status_date)}`
                : ''}
              . Permit issued {timeAgo(permit.issued_date) ?? 'recently'}.
            </>
          ) : (
            <>
              Permit issued {timeAgo(permit.issued_date) ?? 'recently'}. DataSF doesn&apos;t publish
              formal completion estimates — the finish date isn&apos;t known until inspections sign off.
            </>
          )}
        </p>
      )}

      {/* Stat strip — flat, no sidebar. Page fans 4 cols across; panel stays 2.
          Same visual weight per stat block, no vertical dead zone like the
          1+2 grid produced. */}
      <div className={`mt-8 pt-5 border-t border-paper-edge grid ${statGridCols} gap-x-6 gap-y-5`}>
        <DeltaBlock label="Homes" before={permit.existing_units} after={permit.proposed_units} suffix="net new" />
        <DeltaBlock label="Stories" before={permit.existing_stories} after={permit.proposed_stories} suffix="taller" />
        <div>
          <div className="civic-eyebrow mb-1.5">Est. cost</div>
          <div className="font-serif text-2xl text-ink leading-none">
            {formatCost(permit.estimated_cost)}
          </div>
        </div>
        <div>
          <div className="civic-eyebrow mb-1.5">Status</div>
          <div className="text-base text-ink leading-none capitalize">{permit.status}</div>
        </div>
      </div>

      {permit.description && (
        <section className="mt-8 pt-5 border-t border-paper-edge">
          <div className="civic-eyebrow mb-2">Scope of work</div>
          <p className="text-base text-ink leading-relaxed font-serif">{permit.description}</p>
        </section>
      )}

      <section className="mt-8 pt-5 border-t border-paper-edge">
        <div className="civic-eyebrow mb-4">Timeline</div>
        <Timeline steps={steps} />
      </section>

      {coords && (
        <section className="mt-8 pt-5 border-t border-paper-edge">
          <div className="civic-eyebrow mb-1.5">Coordinates</div>
          <div className="text-xs text-ink-soft font-mono">
            {coords[1].toFixed(5)}, {coords[0].toFixed(5)}
          </div>
        </section>
      )}

      <section className="mt-12 pt-8 border-t border-paper-edge">
        <div className="civic-eyebrow mb-4">In the news</div>
        <RelatedArticles address={permit.address} />
      </section>

      <section className="mt-10 pt-8 border-t border-paper-edge">
        <RelatedSources
          address={permit.address}
          permitNumber={permit.permit_number}
          lat={coords?.[1]}
          lng={coords?.[0]}
        />
      </section>

      {!isPanel && (
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
      )}
    </div>
  )
}
