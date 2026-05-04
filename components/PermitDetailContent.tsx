import {
  permitStage,
  timeAgo,
  stageIconSvg,
  useCategory,
  netDelta,
  USE_CATEGORY_LABELS,
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
      <span className="inline-flex" dangerouslySetInnerHTML={{ __html: stageIconSvg(stage, 18) }} />
      <span>{label}</span>
    </div>
  )
}

const USE_CATEGORY_BG: Record<UseCategory, string> = {
  housing: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  retail: 'bg-amber-100 text-amber-900 border-amber-300',
  office: 'bg-sky-100 text-sky-900 border-sky-300',
  mixed: 'bg-violet-100 text-violet-900 border-violet-300',
  industrial: 'bg-stone-200 text-stone-900 border-stone-400',
  other: 'bg-paper-deep text-ink-soft border-paper-edge',
}

function UseTypePill({ category }: { category: UseCategory }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${USE_CATEGORY_BG[category]}`}>
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

function ChangeHeadline({
  category, unitsDelta, storiesDelta, existingUse, proposedUse,
}: {
  category: UseCategory
  unitsDelta: number | null
  storiesDelta: number | null
  existingUse: string | null
  proposedUse: string | null
}) {
  const parts: string[] = []
  if (unitsDelta != null && unitsDelta !== 0) {
    parts.push(`${unitsDelta > 0 ? '+' : ''}${unitsDelta} ${Math.abs(unitsDelta) === 1 ? 'home' : 'homes'}`)
  }
  if (storiesDelta != null && storiesDelta !== 0) {
    parts.push(`${storiesDelta > 0 ? '+' : ''}${storiesDelta} ${Math.abs(storiesDelta) === 1 ? 'story' : 'stories'}`)
  }
  if (existingUse && proposedUse && existingUse.toLowerCase() !== proposedUse.toLowerCase()) {
    parts.push(`${existingUse} → ${proposedUse}`)
  }
  if (parts.length === 0) return null
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
      <UseTypePill category={category} />
      <span className="text-ink-soft">{parts.join(' · ')}</span>
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
            {step.date && <span className="text-ink-faint font-normal"> · {timeAgo(step.date)}</span>}
          </div>
        </li>
      ))}
    </ol>
  )
}

interface Props {
  permit: Permit
  variant?: 'page' | 'panel'
}

export function PermitDetailContent({ permit, variant = 'page' }: Props) {
  const stage = permitStage(permit.status)
  const category = useCategory(permit.proposed_use ?? permit.existing_use)
  const unitsDelta = netDelta(permit.existing_units, permit.proposed_units)
  const storiesDelta = netDelta(permit.existing_stories, permit.proposed_stories)
  const coords = permit.location?.coordinates

  const steps: TimelineStep[] = [
    { label: 'Filed', date: permit.filed_date, active: !!permit.filed_date },
    { label: 'Issued', date: permit.issued_date, active: !!permit.issued_date },
    { label: 'Last activity', date: permit.status_date, active: !!permit.status_date && stage !== 'complete' },
    { label: 'Completed', date: permit.completed_date, active: !!permit.completed_date },
  ]

  const isPanel = variant === 'panel'
  const headingSize = isPanel ? 'text-3xl' : 'text-5xl'
  const contentGrid = isPanel
    ? 'mt-8 space-y-6'
    : 'mt-10 grid md:grid-cols-3 gap-x-8 gap-y-8'
  const sidebarClass = isPanel ? 'space-y-5' : 'md:col-span-1 space-y-5'
  const bodyClass = isPanel ? 'space-y-8' : 'md:col-span-2 space-y-8'

  return (
    <div>
      <div className="civic-eyebrow mb-3">Permit #{permit.permit_number}</div>

      <h1 className={`font-serif ${headingSize} text-ink leading-none tracking-tight mb-3`}>
        {permit.address}
      </h1>

      <p className="font-serif italic text-lg text-ink-soft mb-6">
        {permit.permit_type_definition ?? `Type ${permit.permit_type}`}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge stage={stage} completedDate={permit.completed_date} />
      </div>

      <ChangeHeadline
        category={category}
        unitsDelta={unitsDelta}
        storiesDelta={storiesDelta}
        existingUse={permit.existing_use}
        proposedUse={permit.proposed_use}
      />

      {stage === 'construction' && (
        <p className="text-sm text-ink-soft mt-4 leading-relaxed border-l-2 border-paper-edge pl-4">
          Permit issued {timeAgo(permit.issued_date) ?? 'recently'}. DataSF doesn&apos;t publish
          formal completion estimates — the finish date isn&apos;t known until inspections sign off.
        </p>
      )}

      <div className={contentGrid}>
        <aside className={sidebarClass}>
          <DeltaBlock label="Homes" before={permit.existing_units} after={permit.proposed_units} suffix="net new" />
          <DeltaBlock label="Stories" before={permit.existing_stories} after={permit.proposed_stories} suffix="taller" />
          {(permit.existing_use || permit.proposed_use) && (
            <div>
              <div className="civic-eyebrow mb-1.5">Use</div>
              <div className="text-sm text-ink leading-snug">
                {permit.existing_use && <span className="text-ink-faint">{permit.existing_use}</span>}
                {permit.existing_use && permit.proposed_use && <span className="text-ink-faint mx-1">→</span>}
                {permit.proposed_use && <span>{permit.proposed_use}</span>}
              </div>
            </div>
          )}
          <div>
            <div className="civic-eyebrow mb-1.5">Estimated cost</div>
            <div className="font-serif text-xl text-ink">{formatCost(permit.estimated_cost)}</div>
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

        <div className={bodyClass}>
          {permit.description && (
            <section>
              <div className="civic-eyebrow mb-2">Scope of work</div>
              <p className="text-base text-ink leading-relaxed font-serif">{permit.description}</p>
            </section>
          )}

          <section>
            <div className="civic-eyebrow mb-4">Timeline</div>
            <Timeline steps={steps} />
          </section>
        </div>
      </div>

      <section className="mt-12 pt-8 border-t border-paper-edge">
        <div className="civic-eyebrow mb-4">In the news</div>
        <RelatedArticles address={permit.address} />
      </section>

      <section className="mt-10 pt-8 border-t border-paper-edge">
        <RelatedSources address={permit.address} lat={coords?.[1]} lng={coords?.[0]} />
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
