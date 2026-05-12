'use client'
import { useEffect, useRef, useState } from 'react'
import type { CrossStats, ZoningCategory, TransitTier } from '@/lib/cross-stats'
import type { LensStats } from '@/lib/lens-stats'
import type { LensMode } from './LensRail'
import { NeighborhoodDirectory } from './directory/NeighborhoodDirectory'
import { ZoningDirectory } from './directory/ZoningDirectory'
import { TransitDirectory } from './directory/TransitDirectory'

interface Props {
  mode: LensMode | null
  crossStats: CrossStats | null
  lensStats: LensStats | null
  statusLine: string
  onClose: () => void
  onSelectRegion: (
    kind: 'neighborhood' | 'zoning' | 'tier',
    id: string,
  ) => void
}

export function LensDirectory({ mode, crossStats, lensStats, statusLine, onClose, onSelectRegion }: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!mode) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target) return
      // Don't close if clicking a LensRail chip — those have their own toggle logic.
      if (target.closest('[role="radio"]')) return
      if (!wrapRef.current?.contains(target)) onClose()
    }
    window.addEventListener('keydown', onKey)
    // mousedown so we react before any inner click handlers
    document.addEventListener('mousedown', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [mode, onClose])

  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const sync = () => setIsMobile(window.innerWidth < 768)
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [])

  if (!mode) return null

  return (
    <div
      ref={wrapRef}
      role="dialog"
      aria-label={`${mode} directory`}
      className={
        isMobile
          ? 'fixed bottom-0 left-0 right-0 z-[1001] bg-paper border-t border-paper-edge rounded-t-lg shadow-2xl px-3.5 py-3 max-h-[70dvh] overflow-y-auto'
          : 'bg-paper border border-paper-edge rounded-b-md shadow-md px-3.5 py-3 w-[380px] md:w-[420px] max-w-[calc(100vw-32px)] max-h-[70vh] overflow-y-auto relative z-[1]'
      }
    >
      <div className="pb-2 border-b border-paper-edge/40">
        <div className="text-[9px] font-mono uppercase tracking-wider text-ink-faint">
          Showing
        </div>
        <div className="font-serif text-[13px]">{statusLine}</div>
      </div>

      {mode === 'neighborhoods' && (
        <NeighborhoodDirectory
          geo={crossStats?.neighborhoods ?? []}
          lens={lensStats?.neighborhoods ?? {}}
          onSelect={(name) => onSelectRegion('neighborhood', name)}
        />
      )}
      {mode === 'zoning' && (
        <ZoningDirectory
          geo={crossStats?.zoning ?? []}
          lens={lensStats?.zoning ?? {}}
          onSelect={(cat) => onSelectRegion('zoning', cat as string)}
        />
      )}
      {mode === 'transit' && (
        <TransitDirectory
          geo={crossStats?.transit_tiers ?? []}
          lens={lensStats?.transit_tiers ?? {} as any}
          onSelect={(tier) => onSelectRegion('tier', tier as string)}
        />
      )}
    </div>
  )
}
