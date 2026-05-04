'use client'
import {
  PERMIT_TYPE_IDS,
  PERMIT_TYPE_COLORS,
  PERMIT_TYPE_LABELS,
  STAGE_LABELS,
} from '@/lib/permit-style'

export function MapLegend() {
  return (
    <div className="absolute bottom-4 right-4 z-[1000] bg-white/95 border border-gray-200 rounded shadow text-xs p-3 max-w-[260px]">
      <div className="font-semibold mb-2">Permit type</div>
      <ul className="space-y-1 mb-3">
        {PERMIT_TYPE_IDS.map((id) => (
          <li key={id} className="flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 rounded-full border shrink-0"
              style={{ backgroundColor: PERMIT_TYPE_COLORS[id].fill, borderColor: PERMIT_TYPE_COLORS[id].stroke }}
            />
            <span>{PERMIT_TYPE_LABELS[id]}</span>
          </li>
        ))}
      </ul>

      <div className="font-semibold mb-2">Stage</div>
      <ul className="space-y-1 text-gray-700">
        <li className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full border-2 border-gray-700 bg-transparent shrink-0" />
          <span>{STAGE_LABELS.filed}</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-gray-700 shrink-0" />
          <span>{STAGE_LABELS.active}</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-gray-900 mx-0.5 shrink-0" />
          <span>{STAGE_LABELS.complete}</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-gray-400 opacity-30 shrink-0" />
          <span>{STAGE_LABELS.inactive}</span>
        </li>
      </ul>
    </div>
  )
}
