'use client'
import { useState, useRef, useEffect } from 'react'
import { METRIC_DEFINITIONS, type MetricKey } from '@/lib/metric-definitions'

interface Props {
  metric: MetricKey
  label: string
  className?: string
}

export function MetricHint({ metric, label, className = '' }: Props) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const definition = METRIC_DEFINITIONS[metric]
  if (!definition) return null

  return (
    <span ref={wrapRef} className={`relative inline-flex items-center gap-1 ${className}`}>
      <button
        type="button"
        aria-label={`${label} — what is this?`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-ink-soft hover:text-ink"
      >
        <span>{label}</span>
        <span
          aria-hidden
          className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-paper-edge text-ink-faint text-[8px] font-bold"
        >
          ?
        </span>
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute z-[1200] top-full left-0 mt-2 w-56 bg-ink text-paper text-[11px] leading-snug rounded p-2 shadow-lg"
        >
          {definition}
        </span>
      )}
    </span>
  )
}
