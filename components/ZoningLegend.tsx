'use client'
import { ZONING_LEGEND } from './ZoningOverlay'

/** Small floating legend for the zoning lens. Each row's swatch is a
 *  gradient from light → solid of the gen color so the intensity ramp
 *  (lower density paler, higher density stronger) reads at a glance. */
export function ZoningLegend() {
  return (
    <div
      className="hidden md:block fixed left-4 bottom-28 z-[800] bg-paper/95 backdrop-blur border border-paper-edge rounded-md shadow-md px-3 py-2.5 max-w-[200px]"
      role="figure"
      aria-label="Zoning legend"
    >
      <div className="civic-eyebrow mb-2">Zoning</div>
      <ul className="space-y-1.5">
        {ZONING_LEGEND.map(({ gen, color }) => (
          <li key={gen} className="flex items-center gap-2 text-[12px] text-ink leading-tight">
            <span
              aria-hidden
              className="h-2.5 w-8 rounded-sm shrink-0"
              style={{
                background: `linear-gradient(to right, ${hexWithAlpha(color, 0.12)}, ${hexWithAlpha(color, 0.5)})`,
                boxShadow: `inset 0 0 0 0.5px ${hexWithAlpha(color, 0.5)}`,
              }}
            />
            <span>{gen}</span>
          </li>
        ))}
      </ul>
      <div className="text-[10px] text-ink-faint mt-2 leading-snug">
        Darker = higher allowed density within the family.
      </div>
    </div>
  )
}

function hexWithAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
