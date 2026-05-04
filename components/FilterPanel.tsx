'use client'
import {
  TRACKED_PERMIT_TYPE_IDS,
  PERMIT_TYPE_COLORS,
  PERMIT_TYPE_LABELS,
  STAGE_LABELS,
  type PermitTypeId,
  type PermitStage,
} from '@/lib/permit-style'

const STAGES: PermitStage[] = ['filed', 'active', 'complete', 'inactive']

interface Props {
  selectedTypes: Set<PermitTypeId>
  selectedStages: Set<PermitStage>
  onToggleType: (id: PermitTypeId) => void
  onToggleStage: (stage: PermitStage) => void
}

function StageGlyph({ stage }: { stage: PermitStage }) {
  switch (stage) {
    case 'filed':
      return <span className="inline-block w-3 h-3 rounded-full border-2 border-gray-700 bg-transparent shrink-0" />
    case 'active':
      return <span className="inline-block w-3 h-3 rounded-full bg-gray-700 shrink-0" />
    case 'complete':
      return <span className="inline-block w-2 h-2 rounded-full bg-gray-900 mx-0.5 shrink-0" />
    case 'inactive':
      return <span className="inline-block w-3 h-3 rounded-full bg-gray-400 opacity-30 shrink-0" />
  }
}

export function FilterPanel({ selectedTypes, selectedStages, onToggleType, onToggleStage }: Props) {
  return (
    <div className="absolute bottom-4 right-4 z-[1000] bg-white/95 border border-gray-200 rounded shadow text-xs p-3 max-w-[260px]">
      <div className="font-semibold mb-2">Permit type</div>
      <ul className="space-y-1 mb-3">
        {TRACKED_PERMIT_TYPE_IDS.map((id) => {
          const on = selectedTypes.has(id)
          return (
            <li key={id}>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => onToggleType(id)}
                  className="accent-gray-700"
                />
                <span
                  className={`inline-block w-3 h-3 rounded-full border shrink-0 ${on ? '' : 'opacity-30'}`}
                  style={{
                    backgroundColor: PERMIT_TYPE_COLORS[id].fill,
                    borderColor: PERMIT_TYPE_COLORS[id].stroke,
                  }}
                />
                <span className={on ? '' : 'text-gray-400'}>{PERMIT_TYPE_LABELS[id]}</span>
              </label>
            </li>
          )
        })}
      </ul>

      <div className="font-semibold mb-2">Stage</div>
      <ul className="space-y-1 text-gray-700">
        {STAGES.map((stage) => {
          const on = selectedStages.has(stage)
          return (
            <li key={stage}>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => onToggleStage(stage)}
                  className="accent-gray-700"
                />
                <span className={on ? '' : 'opacity-30'}>
                  <StageGlyph stage={stage} />
                </span>
                <span className={on ? '' : 'text-gray-400'}>{STAGE_LABELS[stage]}</span>
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
