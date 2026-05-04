'use client'
import { STAGE_LABELS, type PermitStage } from '@/lib/permit-style'

const LIFECYCLE: PermitStage[] = ['filed', 'approved', 'construction', 'complete']

interface Props {
  selectedStages: Set<PermitStage>
  onToggleStage: (stage: PermitStage) => void
}

interface GlyphProps {
  stage: PermitStage
  on: boolean
}

function StageGlyph({ stage, on }: GlyphProps) {
  const dim = on ? '' : 'opacity-30'
  switch (stage) {
    case 'filed':
      return <span className={`inline-block w-4 h-4 rounded-full border-2 border-emerald-900 bg-white ${dim}`} />
    case 'approved':
      return <span className={`inline-block w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow ${dim}`} />
    case 'construction':
      return (
        <span className={`relative inline-block w-6 h-6 ${dim}`}>
          <span className="absolute inset-0 rounded-full bg-emerald-500 border-[3px] border-white shadow-md" />
        </span>
      )
    case 'complete':
      return <span className={`inline-block w-3 h-3 rounded-full bg-emerald-900 ${dim}`} />
    case 'inactive':
      return <span className={`inline-block w-4 h-4 rounded-full bg-emerald-500 opacity-30 border border-emerald-900 ${dim}`} />
  }
}

interface RowProps {
  stage: PermitStage
  on: boolean
  onToggle: () => void
  showConnector: boolean
  connectorStyle?: 'solid' | 'dashed'
}

function StageRow({ stage, on, onToggle, showConnector, connectorStyle = 'solid' }: RowProps) {
  const isHeadline = stage === 'construction'
  return (
    <li className="relative">
      <label className="flex items-center gap-3 cursor-pointer select-none py-1.5">
        {/* Glyph column with vertical connector behind it */}
        <span className="relative flex items-center justify-center w-6 h-6 shrink-0 z-10">
          {showConnector && (
            <span
              aria-hidden
              className={`absolute left-1/2 -translate-x-1/2 -top-3 h-3 w-px ${
                connectorStyle === 'dashed'
                  ? 'border-l-2 border-dashed border-gray-300'
                  : 'bg-gray-300'
              }`}
            />
          )}
          <StageGlyph stage={stage} on={on} />
        </span>
        <span className={`flex-1 ${isHeadline ? 'font-semibold' : ''} ${on ? 'text-gray-900' : 'text-gray-400'}`}>
          {STAGE_LABELS[stage]}
          {isHeadline && on && (
            <span className="ml-1.5 text-emerald-700 text-xs">🚧</span>
          )}
        </span>
        <input
          type="checkbox"
          checked={on}
          onChange={onToggle}
          className="w-4 h-4 accent-emerald-700 cursor-pointer"
        />
      </label>
    </li>
  )
}

export function FilterPanel({ selectedStages, onToggleStage }: Props) {
  return (
    <div className="absolute bottom-4 right-4 z-[1000] bg-white border-2 border-gray-300 rounded-lg shadow-lg text-sm text-gray-900 p-4 w-[280px]">
      <div className="font-bold text-gray-900">New construction</div>
      <p className="text-xs text-gray-500 mb-4">SF building permits filed in the last 2 years</p>

      <div className="font-semibold text-xs uppercase tracking-wide text-gray-500 mb-2">Lifecycle</div>
      <ul className="mb-3">
        {LIFECYCLE.map((stage, i) => (
          <StageRow
            key={stage}
            stage={stage}
            on={selectedStages.has(stage)}
            onToggle={() => onToggleStage(stage)}
            showConnector={i > 0}
            connectorStyle="solid"
          />
        ))}
      </ul>

      <div className="border-t border-gray-100 pt-2">
        <ul>
          <StageRow
            stage="inactive"
            on={selectedStages.has('inactive')}
            onToggle={() => onToggleStage('inactive')}
            showConnector={false}
          />
        </ul>
        <p className="text-[10px] text-gray-400 ml-9 -mt-1">Off-track: cancelled, expired, denied</p>
      </div>
    </div>
  )
}
