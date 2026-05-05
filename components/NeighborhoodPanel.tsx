'use client'
import { useEffect, useMemo } from 'react'
import type { Permit } from '@/lib/types'
import {
  permitStage,
  netDelta,
  useCategory,
  stageIconSvg,
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

  // Close on Escape.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const stats = useMemo(() => {
    let totalHomes = 0
    let totalCost = 0
    const stageCounts = new Map<PermitStage, number>()
    const useCounts = new Map<UseCategory, number>()
    for (const p of permits) {
      const stage = permitStage(p)
      stageCounts.set(stage, (stageCounts.get(stage) ?? 0) + 1)
      const cat = useCategory(p.proposed_use ?? p.existing_use)
      useCounts.set(cat, (useCounts.get(cat) ?? 0) + 1)
      const homes = netDelta(p.existing_units, p.proposed_units)
      if (homes != null && homes > 0) totalHomes += homes
      const c = Number(p.estimated_cost ?? 0)
      if (Number.isFinite(c)) totalCost += c
    }
    return { totalHomes, totalCost, stageCounts, useCounts }
  }, [permits])

  const topProjects = useMemo(() => {
    return [...permits]
      .map((p) => ({ p, homes: netDelta(p.existing_units, p.proposed_units) ?? 0 }))
      .filter((x) => x.homes > 0)
      .sort((a, b) => b.homes - a.homes)
      .slice(0, 5)
  }, [permits])

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
      <button
        aria-label="Close neighborhood panel"
        type="button"
        onClick={onClose}
        className={`fixed inset-0 bg-ink/20 z-[1100] transition-opacity duration-300 ease-out ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />
      <aside
        className={`fixed top-0 right-0 h-[100dvh] w-full md:w-[520px] bg-paper border-l-2 border-ink shadow-2xl z-[1200] overflow-y-auto transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!open}
      >
        <div className="sticky top-0 z-10 bg-paper/95 backdrop-blur border-b border-paper-edge px-6 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="civic-eyebrow text-ink-faint">Neighborhood</div>
            <div className="font-serif text-lg text-ink truncate leading-tight">
              {neighborhood ?? '—'}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-soft hover:text-ink text-2xl leading-none w-7 h-7 flex items-center justify-center rounded hover:bg-paper-edge/40 transition-colors"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-8 space-y-7">
          {/* Top-line numbers */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="civic-eyebrow mb-1.5">Active permits</div>
              <div className="font-serif text-3xl text-ink leading-none">{total}</div>
            </div>
            <div>
              <div className="civic-eyebrow mb-1.5">Net new homes</div>
              <div className="font-serif text-3xl text-construction leading-none">
                +{stats.totalHomes}
              </div>
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

          {/* Combined estimated cost */}
          {stats.totalCost > 0 && (
            <div>
              <div className="civic-eyebrow mb-1.5">Combined estimated cost</div>
              <div className="font-serif text-xl text-ink">{formatCost(stats.totalCost)}</div>
            </div>
          )}

          {/* Top projects */}
          {topProjects.length > 0 && (
            <div className="pt-4 border-t border-paper-edge">
              <div className="civic-eyebrow mb-3">Biggest projects</div>
              <ul className="space-y-2">
                {topProjects.map(({ p, homes }) => (
                  <li key={p.permit_number}>
                    <button
                      type="button"
                      onClick={() => onOpenPermit(p.permit_number)}
                      className="w-full text-left flex items-baseline gap-3 hover:bg-paper-deep -mx-2 px-2 py-1 rounded transition-colors"
                    >
                      <span className="font-serif text-construction text-sm font-semibold tabular-nums shrink-0 w-12">
                        +{homes}
                      </span>
                      <span className="font-serif text-ink leading-tight">{p.address}</span>
                    </button>
                  </li>
                ))}
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
