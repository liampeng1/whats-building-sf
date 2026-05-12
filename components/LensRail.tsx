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
  const anyOpen = open !== null
  return (
    <div
      className={`bg-paper border border-paper-edge ${
        anyOpen ? 'rounded-t-md border-b-0' : 'rounded-md'
      } shadow-md flex items-center gap-1 px-1.5 py-1 relative z-[2]`}
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
              // Clicking the active + open chip toggles closed.
              // Clicking any other chip switches lens AND opens.
              if (isActive && isOpen) {
                onOpenChange(null)
                return
              }
              if (!isActive) onChange(m.value)
              onOpenChange(m.value)
            }}
            className={`text-[11px] px-2.5 py-1 rounded-full font-semibold transition inline-flex items-center gap-1 ${
              isActive ? 'bg-ink text-paper' : 'text-ink-soft hover:text-ink'
            }`}
          >
            {m.label}
            <span
              aria-hidden
              className={`inline-block text-[8px] leading-none transition-transform duration-150 ${
                isOpen ? 'rotate-180' : 'rotate-0'
              }`}
            >
              ▾
            </span>
          </button>
        )
      })}
    </div>
  )
}
