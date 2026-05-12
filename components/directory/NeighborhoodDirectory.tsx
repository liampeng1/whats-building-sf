'use client'
import { useMemo, useState } from 'react'
import type { NhoodStats } from '@/lib/cross-stats'
import type { NhoodLensStats } from '@/lib/lens-stats'
import { MetricHint } from '../MetricHint'

interface Props {
  geo: NhoodStats[]
  lens: Record<string, NhoodLensStats>
  onSelect: (name: string) => void
}

type Sort = 'permits' | 'alpha'

const ZONING_COLORS: Record<string, string> = {
  Residential: '#7d9b76',
  'Mixed Use': '#b08968',
  Commercial:  '#5d7a99',
  Industrial:  '#67615a',
  Public:      '#8a6c87',
  Other:       '#a8a29e',
}

export function NeighborhoodDirectory({ geo, lens, onSelect }: Props) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<Sort>('permits')

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = geo.filter((n) => !q || n.nhood.toLowerCase().includes(q))
    const sorted = [...filtered].sort((a, b) => {
      if (sort === 'alpha') return a.nhood.localeCompare(b.nhood)
      return (lens[b.nhood]?.permits_12mo ?? 0) - (lens[a.nhood]?.permits_12mo ?? 0)
    })
    return sorted
  }, [geo, lens, search, sort])

  return (
    <div className="font-sans text-ink">
      <div className="flex gap-2 items-center mt-2">
        <input
          aria-label="Search neighborhoods"
          placeholder="Search 41 neighborhoods…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-2 py-1.5 text-xs bg-paper border border-paper-edge rounded"
        />
        <button
          type="button"
          aria-label="Sort by count"
          onClick={() => setSort('permits')}
          className={`px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider rounded-full ${
            sort === 'permits' ? 'bg-ink text-paper' : 'text-ink-soft border border-paper-edge'
          }`}
        >
          Permits ↓
        </button>
        <button
          type="button"
          onClick={() => setSort('alpha')}
          className={`px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider rounded-full ${
            sort === 'alpha' ? 'bg-ink text-paper' : 'text-ink-soft border border-paper-edge'
          }`}
        >
          A–Z
        </button>
      </div>

      <ul className="mt-2 max-h-[60dvh] overflow-y-auto">
        {rows.length === 0 && (
          <li className="text-xs text-ink-faint py-4 text-center">No matches</li>
        )}
        {rows.map((n) => {
          const s = lens[n.nhood]
          return (
            <li key={n.nhood} className="border-b border-paper-edge/40 py-2">
              <button
                type="button"
                onClick={() => onSelect(n.nhood)}
                aria-label={`${n.nhood} — ${s?.permits_12mo ?? 0} permits`}
                className="w-full text-left"
              >
                <div className="flex items-baseline gap-2">
                  <span className="font-serif text-[13px]">{n.nhood}</span>
                  <span className="ml-auto font-mono text-[11px] text-construction font-semibold">
                    {s?.permits_12mo ?? 0} permits
                  </span>
                </div>
              </button>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-[10px] font-mono text-ink-soft">
                <span className="inline-flex items-center gap-1">
                  <ZoningMixBar share={n.zoning_share} />
                  <MetricHint metric="zoningMix" label="mix" />
                </span>
                <MetricHint metric="homesAdded" label={`+${s?.homes_added_12mo ?? 0} homes`} />
                <MetricHint
                  metric="yoyChange"
                  label={s ? formatYoy(s.yoy_pct) : '—'}
                />
                <MetricHint
                  metric="daysToPermit"
                  label={s && s.median_days_to_permit >= 0 ? `${s.median_days_to_permit} days` : '— days'}
                />
                <MetricHint
                  metric="nearRail"
                  label={`${Math.round(n.near_rail_pct * 100)}% near rail`}
                />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function ZoningMixBar({ share }: { share: Partial<Record<string, number>> }) {
  const order = ['Residential', 'Mixed Use', 'Commercial', 'Industrial', 'Public', 'Other']
  return (
    <span className="inline-flex h-1 w-14 rounded overflow-hidden bg-paper-deep">
      {order.map((k) => {
        const pct = (share as Record<string, number>)[k] ?? 0
        if (pct <= 0) return null
        return (
          <span
            key={k}
            style={{ width: `${pct * 100}%`, background: ZONING_COLORS[k] }}
          />
        )
      })}
    </span>
  )
}

function formatYoy(pct: number): string {
  if (!Number.isFinite(pct)) return '—'
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${Math.round(pct * 100)}% YoY`
}
