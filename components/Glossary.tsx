'use client'
import { useState, type ReactNode } from 'react'
import { getGlossaryEntry } from '@/lib/zoning-glossary'

interface Props {
  term: string
  children?: ReactNode
}

export function Glossary({ term, children }: Props) {
  const entry = getGlossaryEntry(term)
  const [open, setOpen] = useState(false)

  if (!entry) return <span>{children ?? term}</span>

  return (
    <span
      className="glossary-term relative inline cursor-help"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
      role="button"
      aria-describedby={`glossary-${term}`}
    >
      <span style={{ borderBottom: '1px dotted #78716c' }}>{children ?? term}</span>
      {open && (
        <span
          id={`glossary-${term}`}
          role="tooltip"
          className="absolute z-[1200] left-0 top-full mt-1 w-64 bg-paper border border-paper-edge rounded shadow-md p-3 text-[12px] leading-snug normal-case font-normal text-ink-soft"
        >
          <strong className="text-ink">{entry.term}</strong>
          <br />
          {entry.definition}
          {entry.source && (
            <>
              <br />
              <a
                href={entry.source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] uppercase tracking-wider text-ink-faint hover:text-ink"
              >
                {entry.source.section} ↗
              </a>
            </>
          )}
        </span>
      )}
    </span>
  )
}
