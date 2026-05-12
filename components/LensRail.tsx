'use client'

export type LensMode = 'neighborhoods' | 'zoning' | 'transit'

interface Props {
  mode: LensMode
  onChange: (m: LensMode) => void
  open: LensMode | null
  onOpenChange: (next: LensMode | null) => void
}

const MODES: { value: LensMode; label: string }[] = [
  { value: 'neighborhoods', label: 'Neighborhoods' },
  { value: 'zoning',        label: 'Zoning' },
  { value: 'transit',       label: 'Transit' },
]

export function LensRail({ mode, onChange, open, onOpenChange }: Props) {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000]">
      <div
        className="bg-paper border border-paper-edge rounded-md shadow-md flex items-center gap-1 px-1.5 py-1"
        role="radiogroup"
        aria-label="Map lens"
      >
        {MODES.map((m) => {
          const isActive = mode === m.value
          const isOpen = open === m.value
          return (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-expanded={isOpen}
              onClick={() => {
                // Clicking a chip always opens (or keeps open) the drawer
                // with that lens's content. Switching lens swaps content.
                // Closing is via the X, ESC, or click-outside.
                if (!isActive) onChange(m.value)
                onOpenChange(m.value)
              }}
              className={`text-[11px] px-2.5 py-1 rounded-full font-semibold transition ${
                isActive ? 'bg-ink text-paper' : 'text-ink-soft hover:text-ink'
              }`}
            >
              {m.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
