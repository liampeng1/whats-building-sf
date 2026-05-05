'use client'
import { useEffect, useState } from 'react'
import {
  stageIconSvg,
  STAGE_LABELS,
  CATEGORIES,
  USE_CATEGORY_LABELS,
  USE_CATEGORY_COLORS,
  type PermitStage,
  type UseCategory,
} from '@/lib/permit-style'
import type { MinUnitsFilter, CompletedYearsFilter } from './Map'

const LIFECYCLE: PermitStage[] = ['filed', 'approved', 'permitted', 'construction', 'complete']

const MIN_UNITS_OPTIONS: { value: MinUnitsFilter; label: string }[] = [
  { value: 0, label: 'Any' },
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
  visibleCount: number
  totalCount: number
}

const GLYPH_SIZE: Record<PermitStage, number> = {
  filed: 22,
  approved: 22,
  permitted: 24,
  construction: 28,
  complete: 22,
  inactive: 20,
}

function StageGlyph({ stage, on }: { stage: PermitStage; on: boolean }) {
  const size = GLYPH_SIZE[stage]
  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 ${on ? '' : 'opacity-30'}`}
      style={{ width: 28, height: 28 }}
      dangerouslySetInnerHTML={{ __html: stageIconSvg(stage, size) }}
    />
  )
}

function CategoryDot({ cat, on }: { cat: UseCategory; on: boolean }) {
  const c = USE_CATEGORY_COLORS[cat]
  return (
    <span
      className={`inline-block w-3.5 h-3.5 rounded-full border-2 shrink-0 ${on ? '' : 'opacity-30'}`}
      style={{ backgroundColor: c.fill, borderColor: c.stroke }}
    />
  )
}

interface StageRowProps {
  stage: PermitStage
  on: boolean
  onToggle: () => void
  showConnector: boolean
}

function StageRow({ stage, on, onToggle, showConnector }: StageRowProps) {
  const isHeadline = stage === 'construction'
  return (
    <li className="relative">
      <label className="flex items-center gap-3 cursor-pointer select-none py-1.5">
        <span className="relative flex items-center justify-center w-7 h-7 shrink-0 z-10">
          {showConnector && (
            <span
              aria-hidden
              className="absolute left-1/2 -translate-x-1/2 -top-3 h-3 w-px bg-paper-edge"
            />
          )}
          <StageGlyph stage={stage} on={on} />
        </span>
        <span
          className={`flex-1 ${isHeadline ? 'font-semibold' : ''} ${on ? 'text-ink' : 'text-ink-faint'}`}
        >
          {STAGE_LABELS[stage]}
        </span>
        <input
          type="checkbox"
          checked={on}
          onChange={onToggle}
          className="w-4 h-4 cursor-pointer"
          style={{ accentColor: 'var(--ink)' }}
        />
      </label>
    </li>
  )
}

interface CategoryRowProps {
  cat: UseCategory
  on: boolean
  onToggle: () => void
  /** Optional content rendered indented underneath this row when on. */
  subContent?: React.ReactNode
}

function CategoryRow({ cat, on, onToggle, subContent }: CategoryRowProps) {
  return (
    <li>
      <label className="flex items-center gap-3 cursor-pointer select-none py-1">
        <CategoryDot cat={cat} on={on} />
        <span className={`flex-1 ${on ? 'text-ink' : 'text-ink-faint'}`}>
          {USE_CATEGORY_LABELS[cat]}
        </span>
        <input
          type="checkbox"
          checked={on}
          onChange={onToggle}
          className="w-4 h-4 cursor-pointer"
          style={{ accentColor: 'var(--ink)' }}
        />
      </label>
      {subContent && <div className="ml-6 mt-1 mb-2">{subContent}</div>}
    </li>
  )
}

/**
 * Master checkbox for a section header. Three states:
 * - all selected → checked, click clears
 * - none selected → unchecked, click selects all
 * - some selected → indeterminate (rendered as a dash), click selects all
 */
function MasterCheckbox({
  state,
  onSelectAll,
  onClear,
  ariaLabel,
}: {
  state: 'all' | 'none' | 'some'
  onSelectAll: () => void
  onClear: () => void
  ariaLabel: string
}) {
  const checked = state === 'all'
  const indeterminate = state === 'some'
  return (
    <input
      type="checkbox"
      aria-label={ariaLabel}
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = indeterminate
      }}
      onChange={() => (state === 'all' ? onClear() : onSelectAll())}
      className="w-4 h-4 cursor-pointer"
      style={{ accentColor: 'var(--ink)' }}
    />
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
  visibleCount,
  totalCount,
}: Props) {
  const housingOn = selectedCategories.has('housing')
  // Default closed on mobile, open on desktop. Set after mount to avoid SSR mismatch.
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      if (window.matchMedia('(min-width: 768px)').matches) setOpen(true)
    }
  }, [])

  const homesSubFilter = (
    <div className={`${housingOn ? '' : 'opacity-40 pointer-events-none'} transition-opacity duration-200`}>
      <div className="text-[10px] uppercase tracking-wider text-ink-faint mb-1">
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
  )

  return (
    <div className="absolute bottom-4 right-4 z-[1000] bg-paper border border-paper-edge rounded-md shadow-lg w-[calc(100vw-2rem)] max-w-[300px] overflow-hidden max-h-[calc(100dvh-2rem)] flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="bg-ink text-paper px-4 py-3 shrink-0 text-left w-full focus:outline-none focus:ring-2 focus:ring-paper/50"
        aria-expanded={open}
      >
        <div className="flex items-baseline justify-between gap-2">
          <div className="font-serif text-base leading-tight">What&apos;s Building SF</div>
          <div className="flex items-center gap-2">
            {totalCount > 0 && (
              <div className="text-[11px] tabular-nums opacity-80">
                <span className="font-semibold">{visibleCount}</span>
                <span className="opacity-70"> / {totalCount}</span>
              </div>
            )}
            <span
              aria-hidden
              className={`text-base leading-none transition-transform ${open ? 'rotate-180' : ''}`}
            >
              ⌃
            </span>
          </div>
        </div>
        <p className="text-[11px] tracking-wide opacity-70 mt-0.5">
          Major new construction · ongoing &amp; recent
        </p>
      </button>

      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden min-h-0">
      <div className="overflow-y-auto text-sm p-4 max-h-[calc(100dvh-9rem)]">
        <div className="flex items-center justify-between mb-2">
          <div className="civic-eyebrow">Use type</div>
          <MasterCheckbox
            ariaLabel="Toggle all use types"
            state={
              selectedCategories.size === CATEGORIES.length
                ? 'all'
                : selectedCategories.size === 0
                  ? 'none'
                  : 'some'
            }
            onSelectAll={() => onSetCategories(new Set(CATEGORIES))}
            onClear={() => onSetCategories(new Set())}
          />
        </div>
        <ul className="mb-4 space-y-0.5">
          {CATEGORIES.map((cat) => (
            <CategoryRow
              key={cat}
              cat={cat}
              on={selectedCategories.has(cat)}
              onToggle={() => onToggleCategory(cat)}
              subContent={cat === 'housing' ? homesSubFilter : undefined}
            />
          ))}
        </ul>

        <div className="flex items-center justify-between mb-2">
          <div className="civic-eyebrow">Lifecycle</div>
          <MasterCheckbox
            ariaLabel="Toggle all lifecycle stages"
            state={(() => {
              const on = LIFECYCLE.filter((s) => selectedStages.has(s)).length
              if (on === LIFECYCLE.length) return 'all'
              if (on === 0) return 'none'
              return 'some'
            })()}
            onSelectAll={() => onSetStages(new Set<PermitStage>(LIFECYCLE))}
            onClear={() => onSetStages(new Set<PermitStage>())}
          />
        </div>
        <ul className="mb-4">
          {LIFECYCLE.map((stage, i) => (
            <StageRow
              key={stage}
              stage={stage}
              on={selectedStages.has(stage)}
              onToggle={() => onToggleStage(stage)}
              showConnector={i > 0}
            />
          ))}
        </ul>

        <div className="border-t border-paper-edge pt-3">
          <div className="civic-eyebrow mb-2">Show completed within</div>
          <div className="flex gap-1">
            {COMPLETED_YEARS_OPTIONS.map((opt) => (
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
          <p className="text-[10px] text-ink-faint mt-1.5 leading-snug">
            In-progress permits always shown. Cancelled / withdrawn excluded.
          </p>
        </div>
      </div>
        </div>
      </div>
    </div>
  )
}
