'use client'
import { STAGE_LABELS, type PermitStage } from '@/lib/permit-style'

const STAGES: PermitStage[] = ['active', 'filed', 'complete', 'inactive']

interface Props {
  selectedStages: Set<PermitStage>
  onToggleStage: (stage: PermitStage) => void
}

function StageGlyph({ stage }: { stage: PermitStage }) {
  switch (stage) {
    case 'filed':
      return <span className="inline-block w-4 h-4 rounded-full border-2 border-emerald-900 bg-white shrink-0" />
    case 'active':
      return <span className="inline-block w-5 h-5 rounded-full bg-emerald-500 border-2 border-white shadow shrink-0" />
    case 'complete':
      return <span className="inline-block w-3 h-3 rounded-full bg-emerald-900 mx-0.5 shrink-0" />
    case 'inactive':
      return <span className="inline-block w-4 h-4 rounded-full bg-emerald-500 opacity-30 border border-emerald-900 shrink-0" />
  }
}

export function FilterPanel({ selectedStages, onToggleStage }: Props) {
  return (
    <div className="absolute bottom-4 right-4 z-[1000] bg-white border-2 border-gray-300 rounded-lg shadow-lg text-sm text-gray-900 p-4 max-w-[280px]">
      <div className="font-bold mb-1 text-gray-900">New construction</div>
      <p className="text-xs text-gray-500 mb-3">SF building permits filed in the last 2 years</p>

      <div className="font-semibold text-xs uppercase tracking-wide text-gray-500 mb-2">Stage</div>
      <ul className="space-y-2">
        {STAGES.map((stage) => {
          const on = selectedStages.has(stage)
          return (
            <li key={stage}>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => onToggleStage(stage)}
                  className="w-4 h-4 accent-emerald-700 cursor-pointer"
                />
                <span className={`flex items-center justify-center w-6 ${on ? '' : 'opacity-30'}`}>
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
