'use client'
import { useEffect } from 'react'
import {
  CATEGORIES, USE_CATEGORY_LABELS, USE_CATEGORY_COLORS,
  STAGE_LABELS, STAGE_COLORS, STAGE_DEFINITIONS, stageIconSvg,
  type PermitStage, type UseCategory,
} from '@/lib/permit-style'
import type { LensMode } from './LensRail'
import type {
  MinUnitsFilter, CompletedYearsFilter, RecentActivityFilter,
} from './Map'

const LIFECYCLE: PermitStage[] = ['filed', 'approved', 'permitted', 'construction', 'complete']

const MIN_UNITS_OPTIONS: { value: MinUnitsFilter; label: string }[] = [
  { value: 0, label: 'Any' }, { value: 2, label: '2+' }, { value: 5, label: '5+' },
  { value: 25, label: '25+' }, { value: 100, label: '100+' },
]
const COMPLETED_YEARS_OPTIONS: { value: CompletedYearsFilter; label: string }[] = [
  { value: 1, label: '1y' }, { value: 2, label: '2y' }, { value: 5, label: '5y' },
]
const RECENT_ACTIVITY_OPTIONS: { value: RecentActivityFilter; label: string }[] = [
  { value: 0, label: 'Any' }, { value: 6, label: '6mo' }, { value: 12, label: '1y' },
  { value: 24, label: '2y' }, { value: 60, label: '5y' },
]
const TRANSIT_OPTIONS: { value: 'off' | 'rail' | 'rapid-bus' | 'both'; label: string }[] = [
  { value: 'off', label: 'Off' }, { value: 'rail', label: 'Rail' },
  { value: 'rapid-bus', label: 'Rapid bus' }, { value: 'both', label: 'Both' },
]

interface Props {
  open: boolean
  onClose: () => void
  mode: LensMode
  onModeChange: (m: LensMode) => void
  selectedStages: Set<PermitStage>
  onToggleStage: (s: PermitStage) => void
  onSetStages: (next: Set<PermitStage>) => void
  selectedCategories: Set<UseCategory>
  onToggleCategory: (c: UseCategory) => void
  onSetCategories: (next: Set<UseCategory>) => void
  minUnits: MinUnitsFilter
  onMinUnitsChange: (n: MinUnitsFilter) => void
  completedYears: CompletedYearsFilter
  onCompletedYearsChange: (n: CompletedYearsFilter) => void
  recentActivity: RecentActivityFilter
  onRecentActivityChange: (n: RecentActivityFilter) => void
  transit: 'off' | 'rail' | 'rapid-bus' | 'both'
  onTransitChange: (v: 'off' | 'rail' | 'rapid-bus' | 'both') => void
}

export function FilterSheet(props: Props) {
  const { open, onClose } = props
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!props.open) return null

  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close filters"
        onClick={props.onClose}
        className="absolute inset-0 z-[1002] bg-ink/30"
      />
      <aside
        role="dialog"
        aria-modal="true"
        className="absolute bottom-0 left-0 right-0 z-[1003] bg-paper border-t border-paper-edge shadow-2xl rounded-t-lg max-h-[60vh] overflow-y-auto p-4 mx-auto md:max-w-[480px] md:left-1/2 md:-translate-x-1/2 md:bottom-4 md:rounded-lg md:border"
      >
        <div className="space-y-5">
          {/* Lens */}
          <section>
            <div className="civic-eyebrow mb-2">Map lens</div>
            <div className="flex gap-1">
              {(['neighborhoods', 'zoning', 'transit'] as LensMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => props.onModeChange(m)}
                  className={`flex-1 px-2 py-1.5 text-xs rounded border transition ${
                    props.mode === m
                      ? 'bg-ink text-paper border-ink font-semibold'
                      : 'bg-paper text-ink-soft border-paper-edge hover:border-ink'
                  }`}
                >
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
          </section>

          {/* Use type */}
          <section>
            <div className="civic-eyebrow mb-2">Use type</div>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => {
                const on = props.selectedCategories.has(cat)
                const color = USE_CATEGORY_COLORS[cat].fill
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => props.onToggleCategory(cat)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition"
                    style={on
                      ? { color, backgroundColor: `${color}1f`, border: `1.5px solid ${color}` }
                      : { color: '#78716c', backgroundColor: 'transparent', border: '1.5px dashed #d6cfbe' }}
                  >
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full"
                      style={on
                        ? { backgroundColor: color }
                        : { backgroundColor: 'transparent', border: '1.5px solid #a8a29e' }}
                    />
                    {USE_CATEGORY_LABELS[cat]}
                  </button>
                )
              })}
            </div>
            {props.selectedCategories.has('housing') && (
              <div className="mt-2.5">
                <div className="text-[10px] uppercase tracking-wider text-ink-faint mb-1">Net new homes</div>
                <div className="flex gap-1">
                  {MIN_UNITS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => props.onMinUnitsChange(opt.value)}
                      className={`flex-1 px-2 py-1 text-xs rounded border transition ${
                        props.minUnits === opt.value
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
          </section>

          {/* Lifecycle */}
          <section>
            <div className="civic-eyebrow mb-2">Lifecycle</div>
            <div className="flex flex-wrap gap-1.5">
              {LIFECYCLE.map((stage) => {
                const on = props.selectedStages.has(stage)
                const color = STAGE_COLORS[stage].fill
                const label = STAGE_LABELS[stage].split(' / ')[0].split(' · ')[0]
                return (
                  <button
                    key={stage}
                    type="button"
                    onClick={() => props.onToggleStage(stage)}
                    title={STAGE_DEFINITIONS[stage]}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition"
                    style={on
                      ? { color, backgroundColor: `${color}1f`, border: `1.5px solid ${color}` }
                      : { color: '#78716c', backgroundColor: 'transparent', border: '1.5px dashed #d6cfbe' }}
                  >
                    <span
                      className="inline-flex w-3.5 h-3.5"
                      style={{ opacity: on ? 1 : 0.3 }}
                      dangerouslySetInnerHTML={{ __html: stageIconSvg(stage, 14) }}
                    />
                    {label}
                  </button>
                )
              })}
            </div>
            <label className="flex items-center gap-2 text-xs text-ink-soft mt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={props.selectedStages.has('inactive')}
                onChange={() => props.onToggleStage('inactive')}
                className="accent-ink"
              />
              <span>Include cancelled / expired</span>
            </label>
            {props.selectedStages.has('complete') && (
              <div className="mt-2.5">
                <div className="text-[10px] uppercase tracking-wider text-ink-faint mb-1">Completed within</div>
                <div className="flex gap-1">
                  {COMPLETED_YEARS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => props.onCompletedYearsChange(opt.value)}
                      className={`flex-1 px-2 py-1 text-xs rounded border transition ${
                        props.completedYears === opt.value
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
          </section>

          {/* Recent activity */}
          <section>
            <div className="civic-eyebrow mb-2">Recent activity</div>
            <div className="flex gap-1">
              {RECENT_ACTIVITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => props.onRecentActivityChange(opt.value)}
                  className={`flex-1 px-2 py-1 text-xs rounded border transition ${
                    props.recentActivity === opt.value
                      ? 'bg-ink text-paper border-ink font-semibold'
                      : 'bg-paper text-ink-soft border-paper-edge hover:border-ink'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </section>

          {/* Transit-adjacent */}
          <section>
            <div className="civic-eyebrow mb-2">Transit-adjacent only</div>
            <div className="flex gap-1">
              {TRANSIT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => props.onTransitChange(opt.value)}
                  className={`flex-1 px-2 py-1 text-xs rounded border transition ${
                    props.transit === opt.value
                      ? 'bg-ink text-paper border-ink font-semibold'
                      : 'bg-paper text-ink-soft border-paper-edge hover:border-ink'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-ink-faint mt-1.5 leading-snug">
              Rail: within ¼ mi of BART/Muni Metro/Caltrain. Rapid bus: within 0.1 mi of an R-suffix Muni line.
            </p>
          </section>
        </div>
      </aside>
    </>
  )
}
