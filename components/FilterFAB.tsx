'use client'

interface Props {
  open: boolean
  onToggle: () => void
}

export function FilterFAB({ open, onToggle }: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={open ? 'Close filters' : 'Open filters'}
      className="absolute bottom-4 right-4 z-[1001] w-11 h-11 rounded-full bg-ink text-paper flex items-center justify-center shadow-lg hover:bg-ink-soft transition-colors text-xl"
    >
      {open ? '✕' : '☰'}
    </button>
  )
}
