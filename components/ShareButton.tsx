'use client'
import { useState } from 'react'

interface Props {
  /** Title string passed to navigator.share when available. */
  title: string
  /** URL to share. Defaults to the current window URL when omitted. */
  url?: string
  className?: string
}

/**
 * Small icon button that shares via the Web Share API on capable devices
 * (iOS / Android browsers expose the system share sheet) and falls back to
 * a clipboard copy with a brief "Copied" tag elsewhere. Designed to live
 * in panel headers next to the close button.
 */
export function ShareButton({ title, url, className }: Props) {
  const [justCopied, setJustCopied] = useState(false)

  const onClick = async () => {
    const target = url ?? (typeof window !== 'undefined' ? window.location.href : '')
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url: target })
        return
      } catch {
        // User dismissed the share sheet — no fallback needed.
        return
      }
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(target)
        setJustCopied(true)
        setTimeout(() => setJustCopied(false), 1600)
      } catch {
        // Clipboard blocked — silent fail; the user can grab the URL bar.
      }
    }
  }

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onClick={onClick}
        aria-label="Share"
        title="Share"
        className={
          className ??
          'text-ink-soft hover:text-ink w-7 h-7 flex items-center justify-center rounded hover:bg-paper-edge/40 transition-colors'
        }
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
      </button>
      {justCopied && (
        <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 whitespace-nowrap text-[10px] uppercase tracking-wider text-ink-faint bg-paper border border-paper-edge px-1.5 py-0.5 rounded">
          Copied
        </span>
      )}
    </span>
  )
}
