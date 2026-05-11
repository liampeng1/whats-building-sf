'use client'
import type { MapMode } from './MapModeSwitch'
import type { Permit } from '@/lib/types'
import type { CrossStats, ZoningCategory, TransitBand } from '@/lib/cross-stats'

interface Props {
  open: boolean
  onClose: () => void
  mode: MapMode
  crossStats?: CrossStats | null
  permitsByNhood?: Record<string, Permit[]>
  onSelectNhood?: (name: string) => void
  onSelectZoning?: (cat: ZoningCategory) => void
  onSelectTransitBand?: (band: TransitBand) => void
}

export function BrowsePanel({
  open,
  onClose,
  mode,
  crossStats,
  permitsByNhood,
  onSelectNhood,
  onSelectZoning,
  onSelectTransitBand,
}: Props) {
  if (!open) return null
  if (!crossStats) {
    return (
      <aside className="absolute top-4 left-4 z-[1000] bg-paper border border-paper-edge rounded-md shadow-lg w-[calc(100vw-2rem)] max-w-[320px] p-4">
        <header className="flex items-center justify-between mb-2">
          <span className="font-serif text-base">Browse all</span>
          <button onClick={onClose} aria-label="Close" className="text-[14px]">✕</button>
        </header>
        <p className="text-xs text-ink-faint">Stats not loaded yet.</p>
      </aside>
    )
  }

  return (
    <aside className="absolute top-4 left-4 z-[1000] bg-paper border border-paper-edge rounded-md shadow-lg w-[calc(100vw-2rem)] max-w-[320px] max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden">
      <header className="bg-ink text-paper px-4 py-3 flex items-center justify-between shrink-0">
        <span className="font-serif text-base">Browse all</span>
        <button
          onClick={onClose}
          aria-label="Close browse"
          className="text-paper/80 hover:text-paper transition text-[14px]"
        >
          ✕
        </button>
      </header>
      <div className="overflow-y-auto p-4 text-sm">
        {/* MODE: neighborhoods */}
        {mode === 'neighborhoods' && (() => {
          const rows = crossStats.neighborhoods.map((row) => ({
            ...row,
            permitCount: permitsByNhood?.[row.nhood]?.length ?? 0,
          }))
          rows.sort((a, b) => b.permitCount - a.permitCount || b.area_sqm - a.area_sqm)
          const topPermitCount = Math.max(1, ...rows.map((r) => r.permitCount))
          return (
            <section>
              <div className="civic-eyebrow mb-2">All neighborhoods · {rows.length}</div>
              <ul className="space-y-1 -mx-1 px-1">
                {rows.map((row) => {
                  const transitPct = Math.round((row.transit_coverage['0.25mi'] ?? 0) * 100)
                  const widthPct = (row.permitCount / topPermitCount) * 100
                  return (
                    <li key={row.nhood}>
                      <button
                        type="button"
                        onClick={() => onSelectNhood?.(row.nhood)}
                        disabled={!onSelectNhood}
                        className="w-full text-left grid grid-cols-[1fr_auto_auto] items-center gap-2 hover:bg-paper-deep rounded px-1.5 py-1 transition-colors"
                      >
                        <span className="font-serif text-ink text-[13px] truncate leading-tight">
                          {row.nhood}
                        </span>
                        <span className="text-[10px] text-ink-faint uppercase tracking-wider tabular-nums">
                          {transitPct}% rail
                        </span>
                        <span className="text-[11px] tabular-nums w-14 text-right text-ink">
                          {row.permitCount} permits
                        </span>
                        {row.permitCount > 0 && (
                          <span
                            className="col-span-3 h-[3px] rounded -mt-0.5"
                            style={{ width: `${widthPct}%`, backgroundColor: '#9a4a31', opacity: 0.6 }}
                          />
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })()}

        {/* MODE: zoning */}
        {mode === 'zoning' && (
          <section>
            <div className="civic-eyebrow mb-2">Zoning categories · {crossStats.zoning.length}</div>
            <ul className="space-y-2">
              {crossStats.zoning.map((row) => {
                const sharePct = Math.round(row.share_of_sf * 100)
                const transitPct = Math.round((row.transit_coverage['0.25mi'] ?? 0) * 100)
                return (
                  <li key={row.category} className="px-1">
                    <button
                      type="button"
                      onClick={() => onSelectZoning?.(row.category)}
                      disabled={!onSelectZoning}
                      className="w-full text-left hover:bg-paper-deep rounded px-1.5 py-1 transition-colors"
                    >
                      <div className="flex items-baseline justify-between text-sm">
                        <span className="font-serif text-ink">{row.category}</span>
                        <span className="text-[11px] text-ink-soft tabular-nums">
                          {sharePct}% of SF · {transitPct}% near rail
                        </span>
                      </div>
                      <span className="block h-1.5 mt-1 rounded bg-paper-deep">
                        <span
                          className="block h-full rounded"
                          style={{ width: `${sharePct}%`, backgroundColor: '#b08968', opacity: 0.85 }}
                        />
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {/* MODE: transit */}
        {mode === 'transit' && (
          <section>
            <div className="civic-eyebrow mb-2">Distance bands · {crossStats.transit_bands.length}</div>
            <ul className="space-y-2">
              {crossStats.transit_bands.map((row) => {
                const sharePct = Math.round(row.share_of_sf * 100)
                const dominantZoning = Object.entries(row.zoning_share)
                  .sort((a, b) => (b[1] as number) - (a[1] as number))[0]
                return (
                  <li key={row.band} className="px-1">
                    <button
                      type="button"
                      onClick={() => onSelectTransitBand?.(row.band)}
                      disabled={!onSelectTransitBand}
                      className="w-full text-left hover:bg-paper-deep rounded px-1.5 py-1 transition-colors"
                    >
                      <div className="flex items-baseline justify-between text-sm">
                        <span className="font-serif text-ink">≤ {row.band} of rail</span>
                        <span className="text-[11px] text-ink-soft tabular-nums">
                          {sharePct}% of SF
                        </span>
                      </div>
                      <span className="block h-1.5 mt-1 rounded bg-paper-deep">
                        <span
                          className="block h-full rounded"
                          style={{ width: `${sharePct}%`, backgroundColor: '#9a4a31', opacity: 0.85 }}
                        />
                      </span>
                      {dominantZoning && (
                        <div className="text-[10px] text-ink-faint mt-1">
                          Mostly <span className="text-ink-soft">{dominantZoning[0]}</span>{' '}
                          ({Math.round((dominantZoning[1] as number) * 100)}%)
                        </div>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )}
      </div>
    </aside>
  )
}
