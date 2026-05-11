'use client'

export type LensMode = 'neighborhoods' | 'zoning' | 'transit'

interface Props {
  mode: LensMode
  onChange: (m: LensMode) => void
}

const MODES: { value: LensMode; label: string }[] = [
  { value: 'neighborhoods', label: 'Neighborhoods' },
  { value: 'zoning',        label: 'Zoning' },
  { value: 'transit',       label: 'Transit' },
]

export function LensRail({ mode, onChange }: Props) {
  return (
    <div
      className="absolute bottom-4 left-4 z-[1000] bg-paper border border-paper-edge rounded-md shadow-md flex items-center gap-1 px-1.5 py-1"
      role="radiogroup"
      aria-label="Map lens"
    >
      {MODES.map((m) => (
        <button
          key={m.value}
          type="button"
          role="radio"
          aria-checked={mode === m.value}
          onClick={() => onChange(m.value)}
          className={`text-[11px] px-2.5 py-1 rounded-full font-semibold transition ${
            mode === m.value
              ? 'bg-ink text-paper'
              : 'text-ink-soft hover:text-ink'
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}
