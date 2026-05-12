'use client'
import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { METRIC_DEFINITIONS, type MetricKey } from '@/lib/metric-definitions'

interface Props {
  metric: MetricKey
  label: string
  className?: string
}

const TOOLTIP_WIDTH = 224 // matches w-56
const GUTTER = 8

export function MetricHint({ metric, label, className = '' }: Props) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const wrapRef = useRef<HTMLSpanElement | null>(null)
  const tipRef = useRef<HTMLSpanElement | null>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node | null
      if (!target) return
      if (wrapRef.current?.contains(target)) return
      if (tipRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  useLayoutEffect(() => {
    if (!open || !wrapRef.current) return
    const rect = wrapRef.current.getBoundingClientRect()
    // Clamp horizontally so the tooltip doesn't spill past the viewport.
    const left = Math.max(
      GUTTER,
      Math.min(rect.left, window.innerWidth - TOOLTIP_WIDTH - GUTTER),
    )
    setPos({ top: rect.bottom + 6, left })
  }, [open])

  const definition = METRIC_DEFINITIONS[metric]
  if (!definition) return null

  return (
    <>
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
      </span>
      {mounted && open && createPortal(
        <span
          ref={tipRef}
          role="tooltip"
          style={{ top: pos.top, left: pos.left, width: TOOLTIP_WIDTH }}
          className="fixed z-[1200] bg-ink text-paper text-[11px] leading-snug rounded p-2 shadow-lg pointer-events-auto"
        >
          {definition}
        </span>,
        document.body,
      )}
    </>
  )
}
