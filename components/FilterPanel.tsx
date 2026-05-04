'use client'
import { stageIconSvg, STAGE_LABELS, type PermitStage } from '@/lib/permit-style'

const LIFECYCLE: PermitStage[] = ['filed', 'approved', 'construction', 'complete']

interface Props {
  selectedStages: Set<PermitStage>
  onToggleStage: (stage: PermitStage) => void
}

const GLYPH_SIZE: Record<PermitStage, number> = {
  filed: 22,
  approved: 22,
  construction: 28,
  complete: 22,
  inactive: 20,
}

function StageGlyph({ stage, on }: { stage: PermitStage; on: boolean }) {
  const size = GLYPH_SIZE[stage]
  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 ${on ? '' : 'opacity-30'}`}
      style={{ width: 28, height: 28 }}
      dangerouslySetInnerHTML={{ __html: stageIconSvg(stage, size) }}
    />
  )
}

interface RowProps {
  stage: PermitStage
  on: boolean
  onToggle: () => void
  showConnector: boolean
}

function StageRow({ stage, on, onToggle, showConnector }: RowProps) {
  const isHeadline = stage === 'construction'
  return (
    <li className="relative">
      <label className="flex items-center gap-3 cursor-pointer select-none py-1.5">
        <span className="relative flex items-center justify-center w-7 h-7 shrink-0 z-10">
          {showConnector && (
            <span
              aria-hidden
              className="absolute left-1/2 -translate-x-1/2 -top-3 h-3 w-px bg-paper-edge"
            />
          )}
          <StageGlyph stage={stage} on={on} />
        </span>
        <span
          className={`flex-1 ${isHeadline ? 'font-semibold' : ''} ${on ? 'text-ink' : 'text-ink-faint'}`}
        >
          {STAGE_LABELS[stage]}
        </span>
        <input
          type="checkbox"
          checked={on}
          onChange={onToggle}
          className="w-4 h-4 cursor-pointer"
          style={{ accentColor: 'var(--ink)' }}
        />
      </label>
    </li>
  )
}

export function FilterPanel({ selectedStages, onToggleStage }: Props) {
  return (
    <div className="absolute bottom-4 right-4 z-[1000] bg-paper border border-paper-edge rounded-md shadow-lg w-[300px] overflow-hidden">
      <div className="bg-ink text-paper px-4 py-3">
        <div className="font-serif text-base leading-tight">SF In Progress</div>
        <p className="text-[11px] tracking-wide opacity-70 mt-0.5">
          Major new construction · last 2 years
        </p>
      </div>

      <div className="p-4 text-sm">
        <div className="civic-eyebrow mb-2">Lifecycle</div>
        <ul className="mb-3">
          {LIFECYCLE.map((stage, i) => (
            <StageRow
              key={stage}
              stage={stage}
              on={selectedStages.has(stage)}
              onToggle={() => onToggleStage(stage)}
              showConnector={i > 0}
            />
          ))}
        </ul>

        <div className="border-t border-paper-edge pt-2 mt-2">
          <ul>
            <StageRow
              stage="inactive"
              on={selectedStages.has('inactive')}
              onToggle={() => onToggleStage('inactive')}
              showConnector={false}
            />
          </ul>
          <p className="text-[10px] text-ink-faint ml-10 -mt-0.5">
            Off-track: cancelled, expired, denied
          </p>
        </div>
      </div>
    </div>
  )
}
