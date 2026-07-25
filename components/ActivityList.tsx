'use client'
import { useMemo, useState } from 'react'
import type { Polygon, MultiPolygon } from 'geojson'
import type { ActivityEvent } from '@/lib/activity'
import type { PermitStage } from '@/lib/permit-style'
import { ActivityRow } from './ActivityRow'
import { ActivityLead } from './ActivityLead'

export type ParcelMap = Record<string, Polygon | MultiPolygon>

type SortMode = 'significance' | 'newest'

// The four milestones the feed surfaces, in lifecycle order.
const STAGE_CHIPS: { stage: PermitStage; label: string }[] = [
  { stage: 'filed', label: 'Filed' },
  { stage: 'approved', label: 'Approved' },
  { stage: 'construction', label: 'Construction' },
  { stage: 'complete', label: 'Completed' },
]

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? 'border-ink bg-ink text-paper'
          : 'border-paper-edge text-ink-soft hover:border-ink hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

export function ActivityList({
  events,
  now,
  parcels = {},
}: {
  events: ActivityEvent[]
  now: number
  parcels?: ParcelMap
}) {
  const [sort, setSort] = useState<SortMode>('significance')
  const [stages, setStages] = useState<Set<PermitStage>>(new Set())
  const nowDate = useMemo(() => new Date(now), [now])

  const visible = useMemo(() => {
    const filtered = stages.size === 0 ? events : events.filter((e) => stages.has(e.stage))
    if (sort === 'newest') {
      return [...filtered].sort(
        (a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime(),
      )
    }
    return filtered // already significance-sorted by computeActivity
  }, [events, stages, sort])

  function toggleStage(stage: PermitStage) {
    setStages((prev) => {
      const next = new Set(prev)
      if (next.has(stage)) next.delete(stage)
      else next.add(stage)
      return next
    })
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
        <div className="flex flex-wrap gap-1.5">
          {STAGE_CHIPS.map(({ stage, label }) => (
            <Chip key={stage} active={stages.has(stage)} onClick={() => toggleStage(stage)}>
              {label}
            </Chip>
          ))}
        </div>
        <div className="flex items-center gap-1 text-xs">
          <span className="text-ink-soft">Sort</span>
          <button
            type="button"
            aria-pressed={sort === 'significance'}
            onClick={() => setSort('significance')}
            className={`rounded px-2 py-1 font-medium transition-colors ${
              sort === 'significance' ? 'bg-paper-deep text-ink' : 'text-ink-soft hover:text-ink'
            }`}
          >
            Significance
          </button>
          <button
            type="button"
            aria-pressed={sort === 'newest'}
            onClick={() => setSort('newest')}
            className={`rounded px-2 py-1 font-medium transition-colors ${
              sort === 'newest' ? 'bg-paper-deep text-ink' : 'text-ink-soft hover:text-ink'
            }`}
          >
            Newest
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="border-t border-paper-edge py-10 text-center text-sm text-ink-soft">
          No major activity in the last 30 days.
        </p>
      ) : (
        <div>
          <ActivityLead
            event={visible[0]}
            now={nowDate}
            parcel={parcels[visible[0].permit.permit_number]}
          />
          <div className="mt-2">
            {visible.slice(1).map((e) => (
              <ActivityRow
                key={e.permit.permit_number}
                event={e}
                now={nowDate}
                parcel={parcels[e.permit.permit_number]}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
