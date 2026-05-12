'use client'
import { useEffect } from 'react'
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
  useEffect(() => {
    if (!mode) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, onClose])

  if (!mode) return null

  return (
    <div
      role="dialog"
      aria-label={`${mode} directory`}
      className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-[1001] bg-paper border border-paper-edge rounded-md shadow-xl px-3.5 py-3 w-[380px] md:w-[420px] max-w-[calc(100vw-32px)]"
    >
      <div className="text-[9px] font-mono uppercase tracking-wider text-ink-faint">
        Showing
      </div>
      <div className="font-serif text-[13px] pb-2 border-b border-paper-edge/40">
        {statusLine}
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
