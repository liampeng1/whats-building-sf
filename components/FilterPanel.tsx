'use client'
import { Fragment, useState } from 'react'
import { Logo } from './Logo'
import {
  stageIconSvg,
  STAGE_LABELS,
  STAGE_COLORS,
  CATEGORIES,
  USE_CATEGORY_LABELS,
  USE_CATEGORY_COLORS,
  type PermitStage,
  type UseCategory,
} from '@/lib/permit-style'
import type { MinUnitsFilter, CompletedYearsFilter, RecentActivityFilter } from './Map'

const LIFECYCLE: PermitStage[] = ['filed', 'approved', 'permitted', 'construction', 'complete']

const MIN_UNITS_OPTIONS: { value: MinUnitsFilter; label: string }[] = [
  { value: 0, label: 'Any' },
  { value: 2, label: '2+' },
  { value: 5, label: '5+' },
  { value: 25, label: '25+' },
  { value: 100, label: '100+' },
]

const COMPLETED_YEARS_OPTIONS: { value: CompletedYearsFilter; label: string }[] = [
  { value: 0, label: 'Hide' },
  { value: 1, label: '1y' },
  { value: 2, label: '2y' },
  { value: 5, label: '5y' },
]

const RECENT_ACTIVITY_OPTIONS: { value: RecentActivityFilter; label: string }[] = [
  { value: 0, label: 'Any' },
  { value: 6, label: '6mo' },
  { value: 12, label: '1y' },
  { value: 24, label: '2y' },
  { value: 60, label: '5y' },
]

interface Props {
  selectedStages: Set<PermitStage>
  onToggleStage: (stage: PermitStage) => void
  onSetStages: (next: Set<PermitStage>) => void
  selectedCategories: Set<UseCategory>
  onToggleCategory: (cat: UseCategory) => void
  onSetCategories: (next: Set<UseCategory>) => void
  minUnits: MinUnitsFilter
  onMinUnitsChange: (n: MinUnitsFilter) => void
  completedYears: CompletedYearsFilter
  onCompletedYearsChange: (n: CompletedYearsFilter) => void
  recentActivity: RecentActivityFilter
  onRecentActivityChange: (n: RecentActivityFilter) => void
  visibleCount: number
  totalCount: number
}

/**
 * Pill toggle for a lifecycle stage. Borrows the chip styling used on the
 * lot detail page (StatusBadge): tinted fill + colored border + glyph at
 * the stage's color when on; muted neutral chrome when off.
 */
function StageChip({
  stage,
  on,
  onToggle,
}: {
  stage: PermitStage
  on: boolean
  onToggle: () => void
}) {
  const color = STAGE_COLORS[stage].fill
  const label = STAGE_LABELS[stage].split(' / ')[0].split(' · ')[0]
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      // Selected vs not is signaled by THREE cumulative cues so the state
      // is unmistakable: (1) saturated tinted fill vs transparent, (2) solid
      // colored border at 1.5px vs dashed neutral, (3) glyph at full vs
      // 0.3 opacity. Plus a slight overall opacity drop on the off state.
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
        on ? '' : 'opacity-60'
      }`}
      style={
        on
          ? { color, backgroundColor: `${color}1f`, border: `1.5px solid ${color}` }
          : {
              color: '#78716c',
              backgroundColor: 'transparent',
              border: '1.5px dashed #d6cfbe',
            }
      }
    >
      <span
        className="inline-flex w-3.5 h-3.5"
        style={{ opacity: on ? 1 : 0.3 }}
        dangerouslySetInnerHTML={{ __html: stageIconSvg(stage, 14) }}
      />
      {label}
    </button>
  )
}

/**
 * Pill toggle for a use category. Same chip language as StageChip — but the
 * leading mark is a small filled dot in the category's color rather than a
 * glyph, matching the dot style used in NeighborhoodPanel's "use mix".
 */
function CategoryChip({
  cat,
  on,
  onToggle,
}: {
  cat: UseCategory
  on: boolean
  onToggle: () => void
}) {
  const color = USE_CATEGORY_COLORS[cat].fill
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
        on ? '' : 'opacity-60'
      }`}
      style={
        on
          ? { color, backgroundColor: `${color}1f`, border: `1.5px solid ${color}` }
          : {
              color: '#78716c',
              backgroundColor: 'transparent',
              border: '1.5px dashed #d6cfbe',
            }
      }
    >
      {/* Filled dot when selected, hollow ring when not — same dichotomy as
          the chip body: solid vs outlined. */}
      <span
        className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
        style={
          on
            ? { backgroundColor: color }
            : { backgroundColor: 'transparent', border: '1.5px solid #a8a29e' }
        }
      />
      {USE_CATEGORY_LABELS[cat]}
    </button>
  )
}

/** "All / Clear" inline toggle for a section header. */
function MasterButton({
  state,
  onSelectAll,
  onClear,
}: {
  state: 'all' | 'none' | 'some'
  onSelectAll: () => void
  onClear: () => void
}) {
  const action = state === 'all' ? onClear : onSelectAll
  const label = state === 'all' ? 'Clear' : 'All'
  return (
    <button
      type="button"
      onClick={action}
      className="text-[10px] uppercase tracking-wider text-ink-faint hover:text-ink transition-colors"
    >
      {label}
    </button>
  )
}

export function FilterPanel({
  selectedStages,
  onToggleStage,
  onSetStages,
  selectedCategories,
  onToggleCategory,
  onSetCategories,
  minUnits,
  onMinUnitsChange,
  completedYears,
  onCompletedYearsChange,
  recentActivity,
  onRecentActivityChange,
  visibleCount,
  totalCount,
}: Props) {
  // Closed by default on every viewport — the simplified summary tells you
  // most of what you need at a glance; expanding is opt-in.
  const [open, setOpen] = useState(false)
  const housingOn = selectedCategories.has('housing')
  const completeOn = selectedStages.has('complete')

  const lifecycleOnCount = LIFECYCLE.filter((s) => selectedStages.has(s)).length
  const lifecycleState: 'all' | 'none' | 'some' =
    lifecycleOnCount === LIFECYCLE.length
      ? 'all'
      : lifecycleOnCount === 0
        ? 'none'
        : 'some'
  const categoryState: 'all' | 'none' | 'some' =
    selectedCategories.size === CATEGORIES.length
      ? 'all'
      : selectedCategories.size === 0
        ? 'none'
        : 'some'

  // Header reads as a quiet civic-data tagline rather than a stat readout.
  // When filters are reducing the visible set, append a small note so the
  // user understands why the map looks like it does.
  const filtered = visibleCount !== totalCount
  const subtitle =
    'Every major new-construction project in San Francisco — from filing through completion.'
  const filterNote = filtered && totalCount
    ? `${visibleCount.toLocaleString()} of ${totalCount.toLocaleString()} visible`
    : null

  return (
    <div className="absolute top-4 right-4 z-[1000] bg-paper border border-paper-edge rounded-md shadow-lg w-[calc(100vw-2rem)] max-w-[340px] overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="bg-ink text-paper px-4 py-3 shrink-0 text-left w-full focus:outline-none focus:ring-2 focus:ring-paper/50"
        aria-expanded={open}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Logo size={22} variant="on-ink" />
            <div className="font-serif text-base leading-tight">
              What&apos;s Building SF
            </div>
          </div>
          <span
            aria-hidden
            className={`text-xs leading-none transition-transform ${open ? 'rotate-180' : ''}`}
          >
            ▾
          </span>
        </div>
        <p className="text-[13px] tracking-normal opacity-90 mt-1 leading-snug">
          {subtitle}
        </p>
        {/* Lifecycle key — always visible. Glyphs in left-to-right order
            with arrow connectors so the progression filed → … → complete
            reads at a glance. Doubles as the legend for the icons used on
            map pins and in the chip toggles below. */}
        <div className="flex items-center gap-1 mt-2 pt-2 border-t border-paper/15">
          {LIFECYCLE.map((stage, i) => (
            <Fragment key={stage}>
              {i > 0 && (
                <span aria-hidden className="text-paper/40 text-[10px] leading-none">
                  →
                </span>
              )}
              <span
                className="inline-flex shrink-0"
                style={{ width: 18, height: 18 }}
                dangerouslySetInnerHTML={{ __html: stageIconSvg(stage, 18) }}
                title={STAGE_LABELS[stage].split(' / ')[0].split(' · ')[0]}
              />
            </Fragment>
          ))}
          {filterNote && (
            <span className="ml-auto text-[10px] uppercase tracking-wider opacity-70">
              {filterNote}
            </span>
          )}
        </div>
      </button>

      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden min-h-0">
          <div className="overflow-y-auto text-sm p-4 space-y-5 max-h-[calc(100dvh-9rem)]">
            {/* USE TYPE */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <div className="civic-eyebrow">Use type</div>
                <MasterButton
                  state={categoryState}
                  onSelectAll={() => onSetCategories(new Set(CATEGORIES))}
                  onClear={() => onSetCategories(new Set())}
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((cat) => (
                  <CategoryChip
                    key={cat}
                    cat={cat}
                    on={selectedCategories.has(cat)}
                    onToggle={() => onToggleCategory(cat)}
                  />
                ))}
              </div>

              <div
                className={`mt-3 transition-opacity duration-200 ${
                  housingOn ? '' : 'opacity-40 pointer-events-none'
                }`}
              >
                <div className="text-[10px] uppercase tracking-wider text-ink-faint mb-1.5">
                  Net new homes
                </div>
                <div className="flex gap-1">
                  {MIN_UNITS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => onMinUnitsChange(opt.value)}
                      disabled={!housingOn}
                      aria-disabled={!housingOn}
                      className={`flex-1 px-2 py-1 text-xs rounded border transition ${
                        minUnits === opt.value
                          ? 'bg-ink text-paper border-ink font-semibold'
                          : 'bg-paper text-ink-soft border-paper-edge hover:border-ink'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* LIFECYCLE */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <div className="civic-eyebrow">Lifecycle</div>
                <MasterButton
                  state={lifecycleState}
                  onSelectAll={() => onSetStages(new Set<PermitStage>(LIFECYCLE))}
                  onClear={() => onSetStages(new Set<PermitStage>())}
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {LIFECYCLE.map((stage) => (
                  <StageChip
                    key={stage}
                    stage={stage}
                    on={selectedStages.has(stage)}
                    onToggle={() => onToggleStage(stage)}
                  />
                ))}
              </div>

              <div
                className={`mt-3 transition-opacity duration-200 ${
                  completeOn ? '' : 'opacity-40 pointer-events-none'
                }`}
              >
                <div className="text-[10px] uppercase tracking-wider text-ink-faint mb-1.5">
                  Completed within
                </div>
                <div className="flex gap-1">
                  {COMPLETED_YEARS_OPTIONS.filter((o) => o.value > 0).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => onCompletedYearsChange(opt.value)}
                      disabled={!completeOn}
                      aria-disabled={!completeOn}
                      className={`flex-1 px-2 py-1 text-xs rounded border transition ${
                        completedYears === opt.value
                          ? 'bg-ink text-paper border-ink font-semibold'
                          : 'bg-paper text-ink-soft border-paper-edge hover:border-ink'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-ink-soft mt-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selectedStages.has('inactive')}
                  onChange={() => onToggleStage('inactive')}
                  className="accent-ink"
                />
                <span
                  className="inline-flex w-4 h-4 shrink-0"
                  dangerouslySetInnerHTML={{ __html: stageIconSvg('inactive', 14) }}
                />
                <span>Include cancelled / expired</span>
              </label>
            </section>

            {/* RECENT ACTIVITY */}
            <section className="border-t border-paper-edge pt-4">
              <div className="civic-eyebrow mb-2">Recent activity</div>
              <div className="flex gap-1">
                {RECENT_ACTIVITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onRecentActivityChange(opt.value)}
                    className={`flex-1 px-2 py-1 text-xs rounded border transition ${
                      recentActivity === opt.value
                        ? 'bg-ink text-paper border-ink font-semibold'
                        : 'bg-paper text-ink-soft border-paper-edge hover:border-ink'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-ink-faint mt-1.5 leading-snug">
                Hide stalled permits — only show those with recent status updates.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
