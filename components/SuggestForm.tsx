'use client'

import { useState } from 'react'

type Status = 'idle' | 'sending' | 'sent' | 'error' | 'limited'

/**
 * Shared suggestion form. Rendered both inside the floating modal
 * (components/SuggestButton) and inline on /about. POSTs to /api/suggestions,
 * which files the submission as a GitHub issue.
 */
export function SuggestForm({ onDone }: { onDone?: () => void }) {
  const [message, setMessage] = useState('')
  const [from, setFrom] = useState('')
  const [company, setCompany] = useState('') // honeypot — humans leave blank
  const [status, setStatus] = useState<Status>('idle')
  const [issueUrl, setIssueUrl] = useState<string | null>(null)

  const send = async () => {
    if (!message.trim() || status === 'sending') return
    setStatus('sending')
    try {
      const resp = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, from: from.trim() || undefined, company }),
      })
      if (resp.status === 429) {
        setStatus('limited')
        return
      }
      if (!resp.ok) throw new Error(String(resp.status))
      const data = (await resp.json()) as { url?: string }
      setIssueUrl(data.url ?? null)
      setMessage('')
      setStatus('sent')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'sent') {
    return (
      <div className="text-sm text-ink">
        <p className="font-semibold">Thanks — suggestion filed. 🙏</p>
        {issueUrl && (
          <a
            href={issueUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink underline decoration-paper-edge underline-offset-2 hover:decoration-ink"
          >
            View it on GitHub
          </a>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        aria-label="Your suggestion"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={2000}
        rows={4}
        placeholder="What should we change or add?"
        className="text-sm text-ink bg-paper border border-paper-edge rounded-md p-2.5 resize-none outline-none focus:border-ink"
      />
      <input
        aria-label="Your name (optional)"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
        maxLength={100}
        placeholder="Your name (optional)"
        className="text-sm text-ink bg-paper border border-paper-edge rounded-md px-2.5 py-1.5 outline-none focus:border-ink"
      />
      {/* Honeypot: hidden from humans; bots that autofill it get dropped. */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        className="hidden"
      />
      {status === 'error' && (
        <p className="text-sm text-red-600">Couldn&apos;t send — try again.</p>
      )}
      {status === 'limited' && (
        <p className="text-sm text-ink-soft">
          You&apos;ve sent a lot of suggestions today — thanks! Try again tomorrow.
        </p>
      )}
      <div className="flex justify-end gap-2 pt-1">
        {onDone && (
          <button
            onClick={onDone}
            className="text-sm text-ink-soft hover:text-ink px-3 py-1.5 rounded-md border border-paper-edge hover:bg-paper-deep transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          onClick={send}
          disabled={!message.trim() || status === 'sending'}
          className="text-sm font-semibold bg-ink text-paper px-4 py-1.5 rounded-md hover:bg-ink-soft transition-colors disabled:opacity-50"
        >
          {status === 'sending' ? 'Sending…' : 'Send suggestion'}
        </button>
      </div>
    </div>
  )
}
