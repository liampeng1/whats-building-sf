'use client'

import { useState } from 'react'
import { SuggestForm } from './SuggestForm'

/**
 * Floating "Suggest" pill, mounted once in the root layout so it appears on
 * every page. Opens a modal wrapping the shared <SuggestForm />. Positioned
 * above the map's FilterFAB (bottom-right, ~44px tall) so the two don't overlap.
 */
export function SuggestButton() {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-[1000] bg-paper border border-paper-edge rounded-md shadow-md px-3 py-2 text-xs font-medium text-ink-soft hover:text-ink hover:bg-paper-deep hover:border-ink transition-colors flex items-center gap-1.5"
        title="Suggest an idea"
      >
        <span aria-hidden>💡</span>
        <span>Suggest</span>
      </button>
    )
  }

  return (
    <div
      className="fixed inset-0 z-[2000] bg-black/50 grid place-items-center p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-md rounded-lg bg-paper border border-paper-edge shadow-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-ink mb-3">Suggestion box</h2>
        <SuggestForm onDone={() => setOpen(false)} />
      </div>
    </div>
  )
}
