'use client'
import { useEffect, useState } from 'react'
import type { Permit } from '@/lib/types'
import { PermitDetailContent } from './PermitDetailContent'

interface Props {
  permitNumber: string | null
  onClose: () => void
}

export function PermitPanel({ permitNumber, onClose }: Props) {
  const [permit, setPermit] = useState<Permit | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!permitNumber) {
      setPermit(null)
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
      {/* Click-outside backdrop — click to dismiss */}
      <button
        aria-label="Close panel"
        type="button"
        onClick={onClose}
        className={`fixed inset-0 bg-ink/20 z-[1100] transition-opacity duration-300 ease-out ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />
      {/* Right-edge drawer */}
      <aside
        className={`fixed top-0 right-0 h-[100dvh] w-full md:w-[640px] bg-paper border-l-2 border-ink shadow-2xl z-[1200] overflow-y-auto transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!open}
      >
        {/* Sticky header — shows the address itself so it's always visible
            even when scrolled deep into news. Floating close stays clickable. */}
        <div className="sticky top-0 z-10 bg-paper/95 backdrop-blur border-b border-paper-edge px-6 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="civic-eyebrow text-ink-faint">
              {permit ? `Permit #${permit.permit_number}` : 'Permit Record'}
            </div>
            <div className="font-serif text-base text-ink truncate leading-tight">
              {permit?.address ?? ' '}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {permit && (
              <a
                href={`/permits/${permit.permit_number}`}
                target="_blank"
                rel="noopener noreferrer"
                className="civic-eyebrow text-ink-faint hover:text-ink"
                title="Open in a new tab"
              >
                ↗
              </a>
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
          {permit && !loading && !error && <PermitDetailContent permit={permit} variant="panel" />}
        </div>
      </aside>
    </>
  )
}
