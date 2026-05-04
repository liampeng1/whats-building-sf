'use client'
import { CATEGORY_COLORS, CATEGORY_LABELS, STAGE_LABELS, type PermitCategory } from '@/lib/permit-style'

const CATEGORIES: PermitCategory[] = ['new', 'alteration', 'demolition', 'sign', 'other']

export function MapLegend() {
  return (
    <div className="absolute bottom-4 right-4 z-[1000] bg-white/95 border border-gray-200 rounded shadow text-xs p-3 max-w-[220px]">
      <div className="font-semibold mb-2">Permit type</div>
      <ul className="space-y-1 mb-3">
        {CATEGORIES.map((c) => (
          <li key={c} className="flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 rounded-full border"
              style={{ backgroundColor: CATEGORY_COLORS[c].fill, borderColor: CATEGORY_COLORS[c].stroke }}
            />
            <span>{CATEGORY_LABELS[c]}</span>
          </li>
        ))}
      </ul>

      <div className="font-semibold mb-2">Stage</div>
      <ul className="space-y-1 text-gray-700">
        <li className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full border-2 border-gray-700 bg-transparent" />
          <span>{STAGE_LABELS.filed}</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-gray-700" />
          <span>{STAGE_LABELS.active}</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-gray-900 mx-0.5" />
          <span>{STAGE_LABELS.complete}</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-gray-400 opacity-30" />
          <span>{STAGE_LABELS.inactive}</span>
        </li>
      </ul>
    </div>
  )
}
