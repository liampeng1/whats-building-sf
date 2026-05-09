'use client'
import { useEffect, useState } from 'react'
import type { Permit } from '@/lib/types'
import type { BmrRow } from '@/lib/mohcd'
import { PermitDetailContent } from './PermitDetailContent'
import { ShareButton } from './ShareButton'
import { Logo } from './Logo'

interface Props {
  permitNumber: string | null
  onClose: () => void
}

export function PermitPanel({ permitNumber, onClose }: Props) {
  const [permit, setPermit] = useState<Permit | null>(null)
  const [bmr, setBmr] = useState<BmrRow | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  // Mobile bottom-sheet: starts at ~55dvh so the user can still see the
  // map (and the highlighted lot) above the panel. Expands to full height
  // when the user scrolls into the panel content. Desktop ignores this
  // since the panel is a side drawer.
  const [expanded, setExpanded] = useState(false)
  useEffect(() => {
    if (!permitNumber) setExpanded(false)
  }, [permitNumber])

  useEffect(() => {
    if (!permitNumber) {
      setPermit(null)
      setBmr(null)
      setError(null)
      return
    }
    const ctrl = new AbortController()
    setLoading(true)
    setError(null)
    fetch(`/api/permits/${encodeURIComponent(permitNumber)}`, { signal: ctrl.signal })
      .then((r) => {
        if (r.status === 404) throw new Error('not-found')
        if (!r.ok) throw new Error('fetch-failed')
        return r.json() as Promise<Permit>
      })
      .then((p) => {
        setPermit(p)
        setLoading(false)
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return
        setError(err.message === 'not-found' ? 'Permit not found.' : 'Could not load permit.')
        setLoading(false)
      })
    return () => ctrl.abort()
  }, [permitNumber])

  // Best-effort BMR lookup once we have the permit's block + lot. Non-blocking;
  // if it fails the badge just doesn't render.
  useEffect(() => {
    if (!permit?.block || !permit?.lot) {
      setBmr(null)
      return
    }
    const ctrl = new AbortController()
    fetch(
      `/api/bmr/${encodeURIComponent(permit.block)}/${encodeURIComponent(permit.lot)}`,
      { signal: ctrl.signal },
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && data.found) setBmr(data as BmrRow)
        else setBmr(null)
      })
      .catch(() => {})
    return () => ctrl.abort()
    // Depend on block/lot specifically — permit object identity flips on
    // every fetch but block/lot are the only fields the lookup needs.
  }, [permit?.block, permit?.lot])

  // Close on Escape key.
  useEffect(() => {
    if (!permitNumber) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [permitNumber, onClose])

  const open = !!permitNumber

  return (
    <>
      {/* Backdrop — desktop only. On mobile the bottom sheet leaves the
          top of the screen showing the map, so we don't want to mask it. */}
      <button
        aria-label="Close panel"
        type="button"
        onClick={onClose}
        className={`hidden md:block fixed inset-0 bg-ink/20 z-[1100] transition-opacity duration-300 ease-out ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />
      {/* Mobile: bottom sheet. Desktop: right-edge drawer. Same component;
          responsive Tailwind utilities choose the layout. */}
      <aside
        onScroll={(e) => {
          const top = e.currentTarget.scrollTop
          if (top > 40 && !expanded) setExpanded(true)
          else if (top < 4 && expanded) setExpanded(false)
        }}
        className={`fixed bg-paper shadow-2xl z-[1200] overflow-y-auto transition-all duration-300 ease-out
          bottom-0 left-0 right-0 border-t-2 border-ink rounded-t-xl
          ${expanded ? 'h-[100dvh] rounded-t-none' : 'h-[55dvh]'}
          md:top-0 md:right-0 md:left-auto md:bottom-auto md:w-[640px]
          md:h-[100dvh] md:rounded-none md:border-t-0 md:border-l-2
          ${open ? 'translate-y-0' : 'translate-y-full md:translate-y-0 md:translate-x-full'}
          md:translate-y-0
        `}
        aria-hidden={!open}
      >
        {/* Mobile drag handle — visual cue that the sheet pulls up. */}
        <div
          aria-hidden
          className={`md:hidden mx-auto mt-2 mb-1 h-1 w-10 rounded-full bg-paper-edge transition-opacity ${
            expanded ? 'opacity-0' : 'opacity-100'
          }`}
        />
        {/* Sticky header — shows the address itself so it's always visible
            even when scrolled deep into news. Floating close stays clickable. */}
        <div className="sticky top-0 z-10 bg-paper/95 backdrop-blur border-b border-paper-edge px-6 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 civic-eyebrow text-ink-faint">
              <Logo size={14} variant="on-paper" />
              <span>{permit ? `Permit #${permit.permit_number}` : 'Permit Record'}</span>
            </div>
            <div className="font-serif text-base text-ink truncate leading-tight">
              {permit?.address ?? ' '}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {permit && (
              <ShareButton
                title={`${permit.address} · What's Building SF`}
                // Share the in-map URL so recipients land on the panel
                // already open at the right lat/lng, with the rest of the
                // map around for context. generateMetadata in app/page.tsx
                // gives this URL the permit-specific OG card on unfurls.
                url={(() => {
                  if (typeof window === 'undefined') return undefined
                  const params = new URLSearchParams()
                  const coords = permit.location?.coordinates
                  if (coords) {
                    params.set('lat', String(coords[1]))
                    params.set('lng', String(coords[0]))
                  }
                  params.set('permit', permit.permit_number)
                  return `${window.location.origin}/?${params.toString()}`
                })()}
              />
            )}
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

        <div className="px-6 py-8">
          {loading && <div className="text-sm text-ink-faint">Loading permit…</div>}
          {error && (
            <div className="text-sm text-ink-soft">
              {error}{' '}
              <button onClick={onClose} className="text-ink underline">
                Close
              </button>
            </div>
          )}
          {permit && !loading && !error && (
            <PermitDetailContent permit={permit} variant="panel" bmr={bmr} />
          )}
        </div>
      </aside>
    </>
  )
}
