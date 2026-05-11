'use client'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Logo } from './Logo'
import { ShareButton } from './ShareButton'

interface CrossRefRow {
  label: string
  value: string
  pct?: number  // 0..1, drives the bar width
  color?: string
}

interface Props {
  open: boolean
  eyebrow: string  // "Zoning category" / "Transit shed"
  title: string    // "Residential" / "≤ ¼ mi of rail"
  subtitle?: string
  hero?: { eyebrow: string; value: string; detail?: string }
  /** First cross-ref block (e.g. "Top neighborhoods"). */
  primary: { eyebrow: string; rows: CrossRefRow[] }
  /** Second cross-ref block (e.g. "Transit reach" or "Zoning mix"). */
  secondary?: { eyebrow: string; rows: CrossRefRow[] }
  /** Optional extra content rendered after secondary section. */
  children?: ReactNode
  shareUrl?: string
  shareTitle?: string
  onClose: () => void
}

/**
 * Generic "I clicked one of the lens polygons, here's what it tells me"
 * drawer. Shared chrome with NeighborhoodPanel — sticky header, paper
 * card, share + close buttons, bottom-sheet on mobile, side drawer on
 * desktop.
 */
export function LensInfoPanel({
  open,
  eyebrow,
  title,
  subtitle,
  hero,
  primary,
  secondary,
  children,
  shareUrl,
  shareTitle,
  onClose,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  useEffect(() => {
    if (!open) setExpanded(false)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <>
      <button
        aria-label="Close panel"
        type="button"
        onClick={onClose}
        className={`hidden md:block fixed inset-0 bg-ink/20 z-[1100] transition-opacity duration-300 ease-out ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />
      <aside
        onScroll={(e) => {
          const top = e.currentTarget.scrollTop
          if (top > 40 && !expanded) setExpanded(true)
          else if (top < 4 && expanded) setExpanded(false)
        }}
        className={`fixed bg-paper shadow-2xl z-[1200] overflow-y-auto transition-all duration-300 ease-out
          bottom-0 left-0 right-0 border-t-2 border-ink rounded-t-xl
          ${expanded ? 'h-[100dvh] rounded-t-none' : 'h-[55dvh]'}
          md:top-0 md:right-0 md:left-auto md:bottom-auto md:w-[520px]
          md:h-[100dvh] md:rounded-none md:border-t-0 md:border-l-2
          ${open ? 'translate-y-0' : 'translate-y-full md:translate-y-0 md:translate-x-full'}
          md:translate-y-0`}
        aria-hidden={!open}
      >
        <div
          aria-hidden
          className={`md:hidden mx-auto mt-2 mb-1 h-1 w-10 rounded-full bg-paper-edge transition-opacity ${
            expanded ? 'opacity-0' : 'opacity-100'
          }`}
        />
        <div className="sticky top-0 z-10 bg-paper/95 backdrop-blur border-b border-paper-edge px-6 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 civic-eyebrow text-ink-faint">
              <Logo size={14} variant="on-paper" />
              <span>{eyebrow}</span>
            </div>
            <div className="font-serif text-lg text-ink truncate leading-tight">
              {title}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ShareButton
              title={shareTitle ?? `${title} · What's Building SF`}
              url={shareUrl ?? (typeof window !== 'undefined' ? window.location.href : undefined)}
            />
            <button
              type="button"
              onClick={onClose}
              className="text-ink-soft hover:text-ink text-2xl leading-none w-7 h-7 flex items-center justify-center rounded hover:bg-paper-edge/40 transition-colors"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        <div className="px-6 py-8 space-y-7">
          {subtitle && (
            <p className="font-serif italic text-base text-ink-soft leading-snug">
              {subtitle}
            </p>
          )}
          {hero && (
            <div>
              <div className="civic-eyebrow mb-1.5">{hero.eyebrow}</div>
              <div className="font-serif text-3xl text-construction leading-none">
                {hero.value}
              </div>
              {hero.detail && (
                <div className="text-xs text-ink-soft mt-1.5">{hero.detail}</div>
              )}
            </div>
          )}

          <div>
            <div className="civic-eyebrow mb-3">{primary.eyebrow}</div>
            <CrossRefList rows={primary.rows} />
          </div>

          {secondary && (
            <div className="pt-5 border-t border-paper-edge">
              <div className="civic-eyebrow mb-3">{secondary.eyebrow}</div>
              <CrossRefList rows={secondary.rows} />
            </div>
          )}
          {children}
        </div>
      </aside>
    </>
  )
}

function CrossRefList({ rows }: { rows: CrossRefRow[] }) {
  if (rows.length === 0)
    return <p className="text-sm text-ink-faint italic">No data.</p>
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li
          key={r.label}
          className="grid grid-cols-[1fr_auto] items-center gap-3 text-sm"
        >
          <div className="min-w-0">
            <div className="text-ink truncate leading-tight">{r.label}</div>
            {r.pct != null && (
              <span className="block h-1.5 mt-1.5 rounded bg-paper-deep">
                <span
                  className="block h-full rounded"
                  style={{
                    width: `${Math.min(100, Math.max(0, r.pct * 100)).toFixed(1)}%`,
                    backgroundColor: r.color ?? '#9a4a31',
                    opacity: 0.85,
                  }}
                />
              </span>
            )}
          </div>
          <span className="font-serif tabular-nums text-ink whitespace-nowrap">
            {r.value}
          </span>
        </li>
      ))}
    </ul>
  )
}
