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
  selectedTier?: TransitTier | null
  onClose: () => void
  onSelectRegion: (
    kind: 'neighborhood' | 'zoning' | 'tier' | 'district',
    id: string,
    extra?: string,
  ) => void
}

export function LensDirectory({ mode, crossStats, lensStats, statusLine, selectedTier = null, onClose, onSelectRegion }: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!mode) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target) return
      // The LensRail (chips + chevron toggle) has its own click logic that
      // owns open/close. Treat anything inside it as part of the dropdown,
      // not an outside-click.
      if (target.closest('[data-lens-rail]')) return
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
          // On phones: drop directly under the chip rail, fill the available
          // horizontal space, cap at 60% of viewport height. Keeps the
          // dropdown visually connected to the chip the user just tapped
          // (the bottom-sheet was disorienting — chip at top, content at
          // bottom, no perceived link between them).
          ? 'bg-paper border border-paper-edge rounded-b-md shadow-md px-3.5 py-3 w-[calc(100vw-16px)] max-h-[60dvh] overflow-y-auto relative z-[1]'
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
          onSelectDistrict={(code, gen) => onSelectRegion('district', code, gen as string)}
        />
      )}
      {mode === 'transit' && (
        <TransitDirectory
          geo={crossStats?.transit_tiers ?? []}
          lens={lensStats?.transit_tiers ?? {} as any}
          selectedTier={selectedTier}
          onSelect={(tier) => onSelectRegion('tier', tier as string)}
        />
      )}
    </div>
  )
}
