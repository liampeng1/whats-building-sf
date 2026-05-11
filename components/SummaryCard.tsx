'use client'
import { Logo } from './Logo'

export type SummaryCardState = 'none' | 'top5' | 'all'

export interface SummaryCardItem {
  id: string
  name: string
  count: number
}

interface Props {
  state: SummaryCardState
  summary: string
  eyebrow: string
  items: SummaryCardItem[]
  onStateChange: (s: SummaryCardState) => void
  onItemClick: (id: string) => void
}

const TOP_N = 5

export function SummaryCard({ state, summary, eyebrow, items, onStateChange, onItemClick }: Props) {
  const visibleItems = state === 'top5' ? items.slice(0, TOP_N) : state === 'all' ? items : []
  const topCount = Math.max(1, ...items.slice(0, 10).map((i) => i.count))

  const toggleState = () => {
    if (state === 'none') onStateChange('top5')
    else if (state === 'top5') onStateChange('all')
    else onStateChange('none')
  }

  return (
    <aside className="absolute top-4 right-4 z-[1000] bg-ink text-paper rounded-md shadow-lg w-[280px] max-h-[calc(100dvh-2rem)] overflow-hidden flex flex-col">
      <button
        type="button"
        onClick={toggleState}
        className="text-left px-4 pt-3 pb-2 w-full focus:outline-none focus:ring-2 focus:ring-paper/50"
        aria-expanded={state !== 'none'}
      >
        <div className="flex items-center gap-2">
          <Logo size={20} variant="on-ink" />
          <div className="font-serif text-base leading-tight">{eyebrow}</div>
        </div>
        <p className="text-[11px] opacity-85 mt-1 leading-snug">{summary}</p>
      </button>

      {visibleItems.length > 0 && (
        <div className="px-4 pb-3 overflow-y-auto border-t border-paper/15">
          <ul className="space-y-1 pt-2">
            {visibleItems.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onItemClick(item.id)}
                  className="w-full text-left grid grid-cols-[1fr_auto] gap-2 hover:bg-paper/5 rounded px-1 py-0.5 transition-colors"
                >
                  <span className="font-serif text-[13px] truncate leading-tight">{item.name}</span>
                  <span className="text-[11px] tabular-nums opacity-80">{item.count}</span>
                  <span
                    className="col-span-2 h-[2px] rounded mt-0.5"
                    style={{
                      width: `${(item.count / topCount) * 100}%`,
                      background: '#9a4a31',
                      opacity: 0.85,
                    }}
                  />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={toggleState}
        className="text-[10px] uppercase tracking-wider px-4 py-2 border-t border-paper/15 hover:bg-paper/5 transition"
      >
        {state === 'none' && `Show top ${TOP_N} ↓`}
        {state === 'top5' && `See all ${items.length} ↓`}
        {state === 'all' && `Show top ${TOP_N} ↑`}
      </button>
    </aside>
  )
}
