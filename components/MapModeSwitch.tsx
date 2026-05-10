'use client'

export type MapMode = 'neighborhoods' | 'zoning' | 'transit'

interface Props {
  mode: MapMode
  onChange: (m: MapMode) => void
}

const OPTIONS: { value: MapMode; label: string; sub: string }[] = [
  { value: 'neighborhoods', label: 'Neighborhoods', sub: '41 areas' },
  { value: 'zoning', label: 'Zoning', sub: 'by category' },
  { value: 'transit', label: 'Transit', sub: 'rail bands' },
]

/**
 * Three-way segmented control that swaps the map's primary lens. Lives
 * in the FilterPanel header, beneath the brand line, so a glance at the
 * panel tells you both *what's on the map* and *what's filtered*.
 */
export function MapModeSwitch({ mode, onChange }: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="Map view mode"
      className="grid grid-cols-3 gap-0 rounded border border-paper/30 overflow-hidden mt-2"
    >
      {OPTIONS.map((opt) => {
        const on = mode === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(opt.value)}
            className={`px-2 py-1.5 text-[11px] leading-tight transition-colors ${
              on
                ? 'bg-paper text-ink font-semibold'
                : 'bg-transparent text-paper/85 hover:bg-paper/10'
            }`}
          >
            <div className="leading-none">{opt.label}</div>
            <div
              className={`text-[9px] uppercase tracking-wider mt-0.5 ${
                on ? 'text-ink-faint' : 'text-paper/55'
              }`}
            >
              {opt.sub}
            </div>
          </button>
        )
      })}
    </div>
  )
}
