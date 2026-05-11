'use client'
import { Fragment, useState } from 'react'
import { Logo } from './Logo'
import { MapModeSwitch, type MapMode } from './MapModeSwitch'
import { FilterPopover } from './FilterPopover'
import {
  stageIconSvg,
  STAGE_LABELS,
  STAGE_COLORS,
  STAGE_DEFINITIONS,
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
  mapMode: MapMode
  onModeChange: (m: MapMode) => void
  railOnly: boolean
  rapidBusOnly: boolean
  onToggleRail: () => void
  onToggleRapidBus: () => void
  // TODO: Task 4.3 will repurpose these props when BrowsePanel is created
  crossStats?: import('@/lib/cross-stats').CrossStats | null
  permitsByNhood?: Record<string, import('@/lib/types').Permit[]>
  onSelectNhood?: (name: string) => void
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
      title={STAGE_DEFINITIONS[stage]}
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

/** Chip button that opens/closes a named filter popover. */
function TriggerChip({
  id,
  label,
  openFilter,
  setOpenFilter,
}: {
  id: string
  label: string
  openFilter: string | null
  setOpenFilter: (v: string | null) => void
}) {
  const isOpen = openFilter === id
  return (
    <button
      type="button"
      onClick={() => setOpenFilter(isOpen ? null : id)}
      aria-expanded={isOpen}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition ${
        isOpen
          ? 'bg-ink text-paper border-ink'
          : 'bg-paper text-ink border-paper-edge hover:border-ink'
      }`}
    >
      <span className="truncate max-w-[14rem]">{label}</span>
      <span aria-hidden className="text-[9px]">▾</span>
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
  mapMode,
  onModeChange,
  railOnly,
  rapidBusOnly,
  onToggleRail,
  onToggleRapidBus,
  visibleCount,
  totalCount,
}: Props) {
  const [openFilter, setOpenFilter] = useState<string | null>(null)
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

  // Natural-language one-liner describing the active view. Reads as a
  // single sentence rather than a list of chip-style fragments. Each
  // clause only appears when it carries information (i.e. differs from
  // the default), so the line stays brief at common settings.
  const lifecycleOn = LIFECYCLE.filter((s) => selectedStages.has(s))
  const allCats = selectedCategories.size === CATEGORIES.length
  const allLifecycle = lifecycleOn.length === LIFECYCLE.length

  const filterSummary = ((): string => {
    if (selectedCategories.size === 0) return 'No use types selected.'
    if (lifecycleOn.length === 0) return 'No stages selected.'

    // Subject — capitalized in final string. "Major projects" is neutral
    // and doesn't collide with the "construction" stage word.
    let subject: string
    if (allCats) {
      subject = 'major projects'
    } else if (selectedCategories.size === 1) {
      subject = USE_CATEGORY_LABELS[[...selectedCategories][0]].toLowerCase()
    } else {
      const labels = [...selectedCategories].map((c) =>
        USE_CATEGORY_LABELS[c].toLowerCase(),
      )
      subject = labels.length === 2
        ? `${labels[0]} & ${labels[1]}`
        : `${labels.slice(0, -1).join(', ')} & ${labels[labels.length - 1]}`
    }

    // Stage modifier
    const stagePhrases: Record<PermitStage, string> = {
      filed: 'in review',
      approved: 'approved',
      permitted: 'permitted',
      construction: 'under construction',
      complete: 'recently completed',
      inactive: '',
    }
    let stagePhrase = ''
    if (!allLifecycle) {
      if (lifecycleOn.length === 1) {
        stagePhrase = ` ${stagePhrases[lifecycleOn[0]]}`
      } else {
        const labels = lifecycleOn.map((s) =>
          STAGE_LABELS[s].split(' / ')[0].split(' · ')[0].toLowerCase(),
        )
        const last = labels[labels.length - 1]
        stagePhrase = ` in ${labels.slice(0, -1).join(', ')} or ${last} stages`
      }
    }

    // Size clause — only when changed from the 2+ default, and only
    // meaningful when housing is in the selected categories.
    let sizeClause = ''
    if (selectedCategories.has('housing')) {
      if (minUnits === 0) sizeClause = ', any size'
      else if (minUnits !== 2) sizeClause = ` with ${minUnits}+ homes`
    }

    // Recent-activity window — implicit at the 24-month default.
    let timeClause = ''
    if (recentActivity === 0) {
      timeClause = ', any time'
    } else if (recentActivity !== 24) {
      const label =
        recentActivity === 6
          ? 'last 6 months'
          : recentActivity === 12
            ? 'last year'
            : 'last 5 years'
      timeClause = `, ${label}`
    } else {
      timeClause = ', last 2 years'
    }

    // Completed-within window — only when changed from default, and only
    // when the complete stage is part of the selection.
    let completedClause = ''
    if (selectedStages.has('complete')) {
      if (completedYears === 0) completedClause = ', hiding completed'
      else if (completedYears !== 2) {
        const noun = completedYears === 1 ? 'year' : 'years'
        completedClause = ` (completed within ${completedYears} ${noun})`
      }
    }

    const inactiveSuffix = selectedStages.has('inactive') ? ', plus cancelled' : ''
    let transitSuffix = ''
    if (railOnly && rapidBusOnly) transitSuffix = ', rail or rapid bus only'
    else if (railOnly) transitSuffix = ', rail-adjacent only'
    else if (rapidBusOnly) transitSuffix = ', rapid-bus-adjacent only'

    const sentence = `${subject}${stagePhrase}${sizeClause}${timeClause}${completedClause}${transitSuffix}${inactiveSuffix}.`
    return sentence.charAt(0).toUpperCase() + sentence.slice(1)
  })()
  const filtered = visibleCount !== totalCount
  const filterNote = filtered && totalCount
    ? `${visibleCount.toLocaleString()} of ${totalCount.toLocaleString()} visible`
    : null

  // Per-filter summary labels for chip triggers
  const categoryLabel = (() => {
    if (selectedCategories.size === CATEGORIES.length) return 'Use: all'
    if (selectedCategories.size === 0) return 'Use: none'
    if (selectedCategories.size === 1) return `Use: ${USE_CATEGORY_LABELS[[...selectedCategories][0]].toLowerCase()}`
    return `Use: ${selectedCategories.size} of ${CATEGORIES.length}`
  })()

  const stageLabel = (() => {
    if (lifecycleOnCount === LIFECYCLE.length) return 'Stages: all'
    if (lifecycleOnCount === 0) return 'Stages: none'
    if (lifecycleOnCount === 1) {
      const s = LIFECYCLE.find((x) => selectedStages.has(x))!
      return `Stage: ${STAGE_LABELS[s].split(' / ')[0].split(' · ')[0].toLowerCase()}`
    }
    return `Stages: ${lifecycleOnCount} of ${LIFECYCLE.length}`
  })()

  const recentLabel = recentActivity === 0
    ? 'Recent: any'
    : recentActivity === 6 ? 'Recent: 6mo'
    : recentActivity === 12 ? 'Recent: 1y'
    : recentActivity === 24 ? 'Recent: 2y'
    : 'Recent: 5y'

  const transitLabel = (() => {
    if (railOnly && rapidBusOnly) return 'Transit: rail + rapid bus'
    if (railOnly) return 'Transit: rail'
    if (rapidBusOnly) return 'Transit: rapid bus'
    return 'Transit: any'
  })()

  return (
    <div className="absolute top-4 right-4 z-[1000] bg-paper border border-paper-edge rounded-md shadow-lg w-[calc(100vw-2rem)] max-w-[340px] overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
      <div className="bg-ink text-paper shrink-0">
        <div className="px-4 pt-3 pb-2 text-left w-full">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <Logo size={22} variant="on-ink" />
              <div className="font-serif text-base leading-tight">
                What&apos;s Building SF
              </div>
            </div>
          </div>
          <p className="text-[13px] tracking-normal opacity-90 mt-1 leading-snug">
            {filterSummary}
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
        </div>

        {/* Map-mode segmented control. Always visible so you can switch
            lens without interacting with the filter row. */}
        <div className="px-4 pb-3">
          <MapModeSwitch mode={mapMode} onChange={onModeChange} />
        </div>
      </div>

      {/* Chip-trigger row — always visible, one chip per filter group */}
      <div className="px-4 pb-4 pt-3 flex flex-wrap gap-1.5 relative">
        {/* USE TYPE */}
        <div className="relative">
          <TriggerChip id="use-type" label={categoryLabel} openFilter={openFilter} setOpenFilter={setOpenFilter} />
          <FilterPopover open={openFilter === 'use-type'} onClose={() => setOpenFilter(null)}>
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
            {housingOn && (
              <div className="mt-3">
                <div className="text-[10px] uppercase tracking-wider text-ink-faint mb-1.5">
                  Net new homes
                </div>
                <div className="flex gap-1">
                  {MIN_UNITS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => onMinUnitsChange(opt.value)}
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
            )}
          </FilterPopover>
        </div>

        {/* LIFECYCLE */}
        <div className="relative">
          <TriggerChip id="lifecycle" label={stageLabel} openFilter={openFilter} setOpenFilter={setOpenFilter} />
          <FilterPopover open={openFilter === 'lifecycle'} onClose={() => setOpenFilter(null)}>
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
            <label className="flex items-center gap-2 text-xs text-ink-soft mt-3 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedStages.has('inactive')}
                onChange={() => onToggleStage('inactive')}
                className="accent-ink"
              />
              <span>Include cancelled / expired</span>
            </label>
            {completeOn && (
              <div className="mt-3">
                <div className="text-[10px] uppercase tracking-wider text-ink-faint mb-1.5">
                  Completed within
                </div>
                <div className="flex gap-1">
                  {COMPLETED_YEARS_OPTIONS.filter((o) => o.value > 0).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => onCompletedYearsChange(opt.value)}
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
            )}
          </FilterPopover>
        </div>

        {/* RECENT ACTIVITY */}
        <div className="relative">
          <TriggerChip id="recent" label={recentLabel} openFilter={openFilter} setOpenFilter={setOpenFilter} />
          <FilterPopover open={openFilter === 'recent'} onClose={() => setOpenFilter(null)}>
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
          </FilterPopover>
        </div>

        {/* TRANSIT */}
        <div className="relative">
          <TriggerChip id="transit" label={transitLabel} openFilter={openFilter} setOpenFilter={setOpenFilter} />
          <FilterPopover open={openFilter === 'transit'} onClose={() => setOpenFilter(null)}>
            <div className="civic-eyebrow mb-2">Transit-adjacent only</div>
            <label className="flex items-start gap-2 text-xs text-ink-soft cursor-pointer">
              <input
                type="checkbox"
                checked={railOnly}
                onChange={onToggleRail}
                className="accent-ink mt-0.5"
              />
              <span className="flex-1">
                <span className="text-ink font-medium">Rail</span>
                <span className="block text-[10px] text-ink-faint mt-0.5 leading-snug">
                  BART, Muni Metro, Caltrain — within ½ mi
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-xs text-ink-soft cursor-pointer mt-2">
              <input
                type="checkbox"
                checked={rapidBusOnly}
                onChange={onToggleRapidBus}
                className="accent-ink mt-0.5"
              />
              <span className="flex-1">
                <span className="text-ink font-medium">Rapid bus</span>
                <span className="block text-[10px] text-ink-faint mt-0.5 leading-snug">
                  SFMTA Rapid (R-suffix) lines — within 0.1 mi
                </span>
              </span>
            </label>
          </FilterPopover>
        </div>
      </div>
    </div>
  )
}
