'use client'
import { useEffect, useRef, type ReactNode } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  children: ReactNode
  /** Element the popover is anchored to; clicks inside it should NOT close. */
  anchorRef?: React.RefObject<HTMLElement | null>
  className?: string
}

/** Lightweight anchored popover. Closes on Escape and on mouse-down outside
 *  the popover (and outside the optional anchor). No portal — relies on
 *  the parent providing relative positioning. */
export function FilterPopover({ open, onClose, children, anchorRef, className = '' }: Props) {
  const popRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const onDown = (e: MouseEvent) => {
      if (!popRef.current) return
      if (popRef.current.contains(e.target as Node)) return
      if (anchorRef?.current?.contains(e.target as Node)) return
      onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
    }
  }, [open, onClose, anchorRef])

  if (!open) return null
  return (
    <div
      ref={popRef}
      role="dialog"
      className={`absolute z-[1100] mt-1 bg-paper border border-paper-edge rounded-md shadow-lg p-3 min-w-[240px] ${className}`}
    >
      {children}
    </div>
  )
}
