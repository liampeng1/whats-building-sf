'use client'
import { useState } from 'react'
import type { ZoningStats, ZoningCategory } from '@/lib/cross-stats'
import type { ZoningLensStats } from '@/lib/lens-stats'
import { MetricHint } from '../MetricHint'

interface Props {
  geo: ZoningStats[]
  lens: Record<string, ZoningLensStats>
  onSelect: (cat: ZoningCategory) => void
  onSelectDistrict?: (code: string, gen: ZoningCategory) => void
}

const COLORS: Record<ZoningCategory, string> = {
  Residential: '#7d9b76',
  'Mixed Use': '#b08968',
  Commercial:  '#5d7a99',
  Industrial:  '#67615a',
  Public:      '#8a6c87',
  Other:       '#a8a29e',
}

export function ZoningDirectory({ geo, lens, onSelect, onSelectDistrict }: Props) {
  const [expanded, setExpanded] = useState<ZoningCategory | null>(null)

  return (
    <ul className="mt-2 font-sans text-ink">
      {geo.map((z) => {
        const isOpen = expanded === z.category
        const l = lens[z.category]
        return (
          <li key={z.category} className="border-b border-paper-edge/40 py-2">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => {
                setExpanded(isOpen ? null : z.category)
                onSelect(z.category)
              }}
              className="w-full text-left"
            >
              <div className="flex items-center gap-2 font-serif text-[13px]">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ background: COLORS[z.category] }}
                />
                {z.category}
                <span className="ml-auto text-[10px] text-ink-faint">
                  {isOpen ? '▾' : '▸'}
                </span>
              </div>
            </button>

            {/* Meta strip lives outside the button to avoid nested-button HTML. */}
            <div className="mt-1">
              <div className="grid grid-cols-[60px_1fr_32px] items-center gap-1.5 text-[10px] font-mono text-ink-soft">
                <MetricHint metric="landShare" label="Land" />
                <Bar pct={z.share_of_sf} color={COLORS[z.category]} />
                <span className="text-right font-bold">{pct(z.share_of_sf)}</span>
              </div>
              {l && (
                <div className="grid grid-cols-[60px_1fr_32px] items-center gap-1.5 mt-1 text-[10px] font-mono text-ink-soft">
                  <MetricHint metric="permitShare" label="Permits" />
                  <Bar pct={l.permits_share} color="#9a4a31" />
                  <span className="text-right font-bold">{pct(l.permits_share)}</span>
                </div>
              )}
              {l && l.top_neighborhoods.length > 0 && (
                <div className="text-[10px] text-ink-faint mt-1">
                  Top: {l.top_neighborhoods.slice(0, 3).map((n) => (
                    <span key={n} className="text-ink font-medium"> {n} </span>
                  ))}
                </div>
              )}
            </div>

            {isOpen && z.districts.length > 0 && (
              <div className="mt-2 -mx-3 px-3 pt-2 pb-1 bg-paper-deep border-t border-paper-edge/40">
                <div className="text-[9px] font-mono uppercase tracking-wider text-ink-faint mb-1">
                  Districts within {z.category}
                </div>
                {z.districts.slice(0, 12).map((d) => {
                  const row = (
                    <>
                      <span className="font-mono text-[11px] font-semibold">{d.code}</span>
                      <span className="text-[10px] text-ink-faint line-clamp-2 min-w-0 leading-snug">{d.description}</span>
                      <span className="text-right font-mono text-[10px] text-construction font-semibold">
                        {pct(d.land_share_within_cat)}
                      </span>
                    </>
                  )
                  if (!onSelectDistrict) {
                    return (
                      <div key={d.code} className="grid grid-cols-[80px_1fr_40px] gap-2 items-baseline py-0.5">
                        {row}
                      </div>
                    )
                  }
                  return (
                    <button
                      key={d.code}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectDistrict(d.code, z.category)
                      }}
                      className="grid grid-cols-[80px_1fr_40px] gap-2 items-baseline py-1 -mx-1 px-1 w-full text-left rounded hover:bg-paper transition focus:outline-none focus:ring-2 focus:ring-ink/30"
                    >
                      {row}
                    </button>
                  )
                })}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <span className="inline-block h-1.5 w-full bg-paper-deep rounded overflow-hidden">
      <span
        className="block h-full"
        style={{ width: `${Math.max(0, Math.min(1, pct)) * 100}%`, background: color }}
      />
    </span>
  )
}

function pct(x: number): string {
  if (!Number.isFinite(x)) return '—'
  if (x === 0) return '0%'
  if (x < 0.005) return '<1%'
  return `${Math.round(x * 100)}%`
}
