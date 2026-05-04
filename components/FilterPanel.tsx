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
      return <span className="inline-block w-4 h-4 rounded-full border-2 border-gray-900 bg-white shrink-0" />
    case 'active':
      return <span className="inline-block w-4 h-4 rounded-full bg-gray-900 shrink-0" />
    case 'complete':
      return <span className="inline-block w-3 h-3 rounded-full bg-black mx-0.5 shrink-0" />
    case 'inactive':
      return <span className="inline-block w-4 h-4 rounded-full bg-gray-500 opacity-40 border border-gray-700 shrink-0" />
  }
}

export function FilterPanel({ selectedTypes, selectedStages, onToggleType, onToggleStage }: Props) {
  return (
    <div className="absolute bottom-4 right-4 z-[1000] bg-white border-2 border-gray-300 rounded-lg shadow-lg text-sm text-gray-900 p-4 max-w-[280px]">
      <div className="font-bold mb-2 text-gray-900">Permit type</div>
      <ul className="space-y-1.5 mb-4">
        {TRACKED_PERMIT_TYPE_IDS.map((id) => {
          const on = selectedTypes.has(id)
          return (
            <li key={id}>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => onToggleType(id)}
                  className="w-4 h-4 accent-gray-900 cursor-pointer"
                />
                <span
                  className={`inline-block w-4 h-4 rounded-full border-2 shrink-0 ${on ? '' : 'opacity-30'}`}
                  style={{
                    backgroundColor: PERMIT_TYPE_COLORS[id].fill,
                    borderColor: PERMIT_TYPE_COLORS[id].stroke,
                  }}
                />
                <span className={on ? 'text-gray-900' : 'text-gray-400'}>{PERMIT_TYPE_LABELS[id]}</span>
              </label>
            </li>
          )
        })}
      </ul>

      <div className="font-bold mb-2 text-gray-900">Stage</div>
      <ul className="space-y-1.5">
        {STAGES.map((stage) => {
          const on = selectedStages.has(stage)
          return (
            <li key={stage}>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => onToggleStage(stage)}
                  className="w-4 h-4 accent-gray-900 cursor-pointer"
                />
                <span className={on ? '' : 'opacity-30'}>
                  <StageGlyph stage={stage} />
                </span>
                <span className={on ? 'text-gray-900' : 'text-gray-400'}>{STAGE_LABELS[stage]}</span>
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
