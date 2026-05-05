'use client'
import { useEffect, useMemo, useState } from 'react'
import type { Permit } from '@/lib/types'
import { ShareButton } from './ShareButton'
import {
  permitStage,
  netDelta,
  useCategory,
  stageIconSvg,
  dedupeProjectPermits,
  STAGE_COLORS,
  STAGE_LABELS,
  STAGE_ORDER,
  USE_CATEGORY_LABELS,
  type PermitStage,
  type UseCategory,
} from '@/lib/permit-style'

interface Props {
  neighborhood: string | null
  permits: Permit[]
  onClose: () => void
  onOpenPermit: (id: string) => void
}

const PIPELINE_STAGES: PermitStage[] = STAGE_ORDER.filter((s) => s !== 'inactive')

function formatCost(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '—'
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n)}`
}

export function NeighborhoodPanel({ neighborhood, permits, onClose, onOpenPermit }: Props) {
  const open = !!neighborhood

  // Bottom-sheet expansion on mobile (mirrors PermitPanel): start at ~55dvh
  // so the polygon is visible above; expand on scroll past the threshold;
  // collapse back when scrolled to the top.
  const [expanded, setExpanded] = useState(false)
  useEffect(() => {
    if (!open) setExpanded(false)
  }, [open])

  // Close on Escape.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Dedupe by parcel for project-level metrics (homes, cost, top projects).
  // Permit counts and recent-activity stay raw — a permit is a permit.
  const projectPermits = useMemo(() => dedupeProjectPermits(permits), [permits])

  const stats = useMemo(() => {
    let totalHomes = 0
    let totalCost = 0
    const stageCounts = new Map<PermitStage, number>()
    const useCounts = new Map<UseCategory, number>()
    const homesByStage = new Map<PermitStage, number>()
    for (const p of permits) {
      const stage = permitStage(p)
      stageCounts.set(stage, (stageCounts.get(stage) ?? 0) + 1)
      const cat = useCategory(p.proposed_use ?? p.existing_use)
      useCounts.set(cat, (useCounts.get(cat) ?? 0) + 1)
    }
    for (const p of projectPermits) {
      const stage = permitStage(p)
      const homes = netDelta(p.existing_units, p.proposed_units)
      if (homes != null && homes > 0) {
        totalHomes += homes
        homesByStage.set(stage, (homesByStage.get(stage) ?? 0) + homes)
      }
      const c = Number(p.estimated_cost ?? 0)
      if (Number.isFinite(c)) totalCost += c
    }
    return { totalHomes, totalCost, stageCounts, useCounts, homesByStage }
  }, [permits, projectPermits])

  // Rank biggest projects by net new homes when housing is in the mix; fall
  // back to estimated cost so non-residential categories (office/retail/
  // industrial) still surface a meaningful "biggest" list.
  const topProjects = useMemo(() => {
    const withHomes = projectPermits
      .map((p) => ({ p, homes: netDelta(p.existing_units, p.proposed_units) ?? 0 }))
      .filter((x) => x.homes > 0)
    if (withHomes.length > 0) {
      return {
        rankedBy: 'homes' as const,
        rows: withHomes.sort((a, b) => b.homes - a.homes).slice(0, 5),
      }
    }
    const withCost = projectPermits
      .map((p) => ({ p, cost: Number(p.estimated_cost ?? 0) }))
      .filter((x) => Number.isFinite(x.cost) && x.cost > 0)
    return {
      rankedBy: 'cost' as const,
      rows: withCost.sort((a, b) => b.cost - a.cost).slice(0, 5),
    }
  }, [projectPermits])

  const recentActivity = useMemo(() => {
    return [...permits]
      .filter((p) => !!p.status_date)
      .sort((a, b) => (a.status_date! < b.status_date! ? 1 : -1))
      .slice(0, 5)
  }, [permits])

  const total = permits.length
  const maxStageCount = Math.max(1, ...stats.stageCounts.values())

  return (
    <>
      {/* Backdrop — desktop only. On mobile the bottom sheet leaves the
          top of the screen showing the highlighted polygon, so we don't
          want to mask it. */}
      <button
        aria-label="Close neighborhood panel"
        type="button"
        onClick={onClose}
        className={`hidden md:block fixed inset-0 bg-ink/20 z-[1100] transition-opacity duration-300 ease-out ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />
      <aside
        onScroll={(e) => {
          const top = e.currentTarget.scrollTop
          if (top > 40 && !expanded) setExpanded(true)
          else if (top < 4 && expanded) setExpanded(false)
        }}
        className={`fixed bg-paper shadow-2xl z-[1200] overflow-y-auto transition-all duration-300 ease-out
          bottom-0 left-0 right-0 border-t-2 border-ink rounded-t-xl
          ${expanded ? 'h-[100dvh] rounded-t-none' : 'h-[55dvh]'}
          md:top-0 md:right-0 md:left-auto md:bottom-auto md:w-[520px]
          md:h-[100dvh] md:rounded-none md:border-t-0 md:border-l-2
          ${open ? 'translate-y-0' : 'translate-y-full md:translate-y-0 md:translate-x-full'}
          md:translate-y-0
        `}
        aria-hidden={!open}
      >
        {/* Mobile drag handle — visual cue that the sheet pulls up. */}
        <div
          aria-hidden
          className={`md:hidden mx-auto mt-2 mb-1 h-1 w-10 rounded-full bg-paper-edge transition-opacity ${
            expanded ? 'opacity-0' : 'opacity-100'
          }`}
        />
        <div className="sticky top-0 z-10 bg-paper/95 backdrop-blur border-b border-paper-edge px-6 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="civic-eyebrow text-ink-faint">Neighborhood</div>
            <div className="font-serif text-lg text-ink truncate leading-tight">
              {neighborhood ?? '—'}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {neighborhood && (
              <ShareButton
                title={`${neighborhood} · What's Building SF`}
                // Canonical neighborhood URL so the unfurl picks up the
                // per-neighborhood OG image instead of the home default.
                url={
                  typeof window !== 'undefined'
                    ? `${window.location.origin}/neighborhoods/${encodeURIComponent(neighborhood)}`
                    : undefined
                }
              />
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-ink-soft hover:text-ink text-2xl leading-none w-7 h-7 flex items-center justify-center rounded hover:bg-paper-edge/40 transition-colors"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        <div className="px-6 py-8 space-y-7">
          {/* Top-line numbers */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="civic-eyebrow mb-1.5">Active permits</div>
              <div className="font-serif text-3xl text-ink leading-none">{total}</div>
            </div>
            <div>
              <div className="civic-eyebrow mb-1.5">
                {stats.totalHomes > 0 ? 'Net new homes' : 'Estimated cost'}
              </div>
              <div className="font-serif text-3xl text-construction leading-none">
                {stats.totalHomes > 0
                  ? `+${stats.totalHomes}`
                  : stats.totalCost > 0
                    ? formatCost(stats.totalCost)
                    : '—'}
              </div>
              {stats.totalHomes > 0 && (
                <ul className="mt-2 space-y-0.5">
                  {PIPELINE_STAGES.map((stage) => {
                    const count = stats.homesByStage.get(stage) ?? 0
                    if (count === 0) return null
                    const color = STAGE_COLORS[stage].fill
                    const label = STAGE_LABELS[stage].split(' / ')[0].split(' · ')[0]
                    return (
                      <li
                        key={stage}
                        className="flex items-center gap-1.5 text-[0.7rem]"
                      >
                        <span
                          className="inline-flex w-3 h-3 shrink-0"
                          dangerouslySetInnerHTML={{ __html: stageIconSvg(stage, 12) }}
                        />
                        <span
                          className="font-semibold tabular-nums"
                          style={{ color }}
                        >
                          +{count}
                        </span>
                        <span className="text-ink-soft">{label}</span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Stage breakdown bar chart */}
          {total > 0 && (
            <div>
              <div className="civic-eyebrow mb-3">Pipeline mix</div>
              <ul className="space-y-2">
                {PIPELINE_STAGES.map((stage) => {
                  const count = stats.stageCounts.get(stage) ?? 0
                  if (count === 0) return null
                  const color = STAGE_COLORS[stage].fill
                  const widthPct = (count / maxStageCount) * 100
                  return (
                    <li key={stage} className="flex items-center gap-2 text-sm">
                      <span
                        className="inline-flex w-4 h-4 shrink-0"
                        dangerouslySetInnerHTML={{ __html: stageIconSvg(stage, 14) }}
                      />
                      <span
                        className="font-semibold tabular-nums w-7 text-right"
                        style={{ color }}
                      >
                        {count}
                      </span>
                      <span className="text-ink-soft text-xs w-32 shrink-0">
                        {STAGE_LABELS[stage].split(' / ')[0].split(' · ')[0]}
                      </span>
                      <span
                        className="h-2 rounded-full"
                        style={{ width: `${widthPct}%`, backgroundColor: color, opacity: 0.6 }}
                      />
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {/* Use type mix */}
          {total > 0 && (
            <div>
              <div className="civic-eyebrow mb-2">Use mix</div>
              <div className="text-sm text-ink-soft">
                {Array.from(stats.useCounts.entries())
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, n], i) => (
                    <span key={cat}>
                      {i > 0 && <span className="text-ink-faint mx-1.5">·</span>}
                      <span className="text-ink font-medium">{n}</span>{' '}
                      <span>{USE_CATEGORY_LABELS[cat]}</span>
                    </span>
                  ))}
              </div>
            </div>
          )}

          {/* Combined estimated cost — only when housing has displaced it as the
              headline; otherwise it'd duplicate the top-line "Estimated cost". */}
          {stats.totalHomes > 0 && stats.totalCost > 0 && (
            <div>
              <div className="civic-eyebrow mb-1.5">Combined estimated cost</div>
              <div className="font-serif text-xl text-ink">{formatCost(stats.totalCost)}</div>
            </div>
          )}

          {/* Top projects */}
          {topProjects.rows.length > 0 && (
            <div className="pt-4 border-t border-paper-edge">
              <div className="civic-eyebrow mb-3">
                Biggest projects (by {topProjects.rankedBy === 'homes' ? 'net new homes' : 'estimated cost'})
              </div>
              <ul className="space-y-2">
                {topProjects.rows.map((row) => {
                  const p = row.p
                  const homes = 'homes' in row ? row.homes : 0
                  const stage = permitStage(p)
                  const stageColor = STAGE_COLORS[stage].fill
                  const stageLabel = STAGE_LABELS[stage].split(' / ')[0].split(' · ')[0]
                  const cat = useCategory(p.proposed_use ?? p.existing_use)
                  const cost = Number(p.estimated_cost ?? 0)
                  return (
                    <li key={p.permit_number}>
                      <button
                        type="button"
                        onClick={() => onOpenPermit(p.permit_number)}
                        className="w-full text-left flex gap-3 hover:bg-paper-deep -mx-2 px-2 py-1.5 rounded transition-colors"
                      >
                        <span className="shrink-0 w-16 pt-0.5">
                          {topProjects.rankedBy === 'homes' ? (
                            <>
                              <span className="font-serif text-construction text-base font-semibold tabular-nums leading-none">
                                +{homes}
                              </span>
                              <span className="block text-[0.65rem] uppercase tracking-wide text-ink-faint mt-0.5">
                                {homes === 1 ? 'home' : 'homes'}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="font-serif text-construction text-sm font-semibold tabular-nums leading-none">
                                {formatCost(cost)}
                              </span>
                              <span className="block text-[0.65rem] uppercase tracking-wide text-ink-faint mt-0.5">
                                est. cost
                              </span>
                            </>
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-serif text-ink leading-tight">
                            {p.address}
                          </span>
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[0.7rem]">
                            <span
                              className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide"
                              style={{ color: stageColor }}
                            >
                              <span
                                className="inline-flex w-3 h-3"
                                dangerouslySetInnerHTML={{ __html: stageIconSvg(stage, 12) }}
                              />
                              {stageLabel}
                            </span>
                            <span className="text-ink-faint">·</span>
                            <span className="text-ink-soft">{USE_CATEGORY_LABELS[cat]}</span>
                            {topProjects.rankedBy === 'homes' && cost > 0 && (
                              <>
                                <span className="text-ink-faint">·</span>
                                <span className="text-ink-soft tabular-nums">{formatCost(cost)}</span>
                              </>
                            )}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {/* Recent activity */}
          {recentActivity.length > 0 && (
            <div className="pt-4 border-t border-paper-edge">
              <div className="civic-eyebrow mb-3">Recent activity</div>
              <ul className="space-y-2">
                {recentActivity.map((p) => {
                  const stage = permitStage(p)
                  const color = STAGE_COLORS[stage].fill
                  return (
                    <li key={p.permit_number}>
                      <button
                        type="button"
                        onClick={() => onOpenPermit(p.permit_number)}
                        className="w-full text-left flex items-baseline gap-3 hover:bg-paper-deep -mx-2 px-2 py-1 rounded transition-colors"
                      >
                        <span
                          className="text-xs font-semibold uppercase tracking-wide shrink-0 w-24"
                          style={{ color }}
                        >
                          {STAGE_LABELS[stage].split(' / ')[0].split(' · ')[0]}
                        </span>
                        <span className="font-serif text-ink text-sm leading-tight">
                          {p.address}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {total === 0 && (
            <div className="text-sm text-ink-faint italic">
              No active permits in this neighborhood with the current filters.
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
