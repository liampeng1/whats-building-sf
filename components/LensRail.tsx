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
      data-lens-rail
      className={`bg-paper border border-paper-edge ${
        anyOpen ? 'rounded-t-md border-b-0' : 'rounded-md'
      } shadow-md flex items-center gap-1 pl-1.5 pr-1 py-1 relative z-[2]`}
    >
      <div role="radiogroup" aria-label="Map lens" className="flex items-center gap-1">
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
                if (isActive && isOpen) {
                  onOpenChange(null)
                  return
                }
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
      <span className="inline-block w-px h-4 bg-paper-edge/70 mx-1" aria-hidden />
      <button
        type="button"
        aria-label={anyOpen ? 'Close directory' : 'Open directory'}
        aria-expanded={anyOpen}
        onClick={() => onOpenChange(anyOpen ? null : mode)}
        className="w-6 h-6 inline-flex items-center justify-center rounded-full text-ink-soft hover:text-ink hover:bg-paper-deep transition focus:outline-none focus:ring-2 focus:ring-ink/30"
      >
        <svg
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="none"
          aria-hidden
          className={`transition-transform duration-200 ease-out ${anyOpen ? 'rotate-180' : 'rotate-0'}`}
        >
          <path
            d="M1 1.25L5 4.75L9 1.25"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  )
}
