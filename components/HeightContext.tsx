'use client'
import { SF_HEIGHT_REFERENCES } from '@/lib/sf-height-references'

interface Props {
  height_ft: number
  districtCode: string
}

// References shown as tick marks on the thermometer
const TICK_NAMES = [
  'Person',
  '3-story Victorian',
  'Coit Tower',
  'One Embarcadero Center',
  'Transamerica Pyramid',
  'Salesforce Tower',
]

// Break-axis bands — each maps a ft range to a fraction of chart pixel height
const BANDS = [
  { from: 0,    to: 50,   pxFraction: 0.20 },  // human / residential scale
  { from: 50,   to: 250,  pxFraction: 0.22 },  // civic scale
  { from: 250,  to: 600,  pxFraction: 0.25 },  // mid towers
  { from: 600,  to: 900,  pxFraction: 0.18 },  // tall towers
  { from: 900,  to: 1100, pxFraction: 0.15 },  // Salesforce
] as const

const CHART_H = 280          // total SVG height
const BAR_X   = 48           // x of left edge of bar
const BAR_W   = 10           // width of the vertical bar
const LABEL_X = BAR_X + BAR_W + 8  // x where tick labels start
const SVG_W   = 340          // total SVG width

/** Map a height in feet to a y pixel (0 = top = tallest, CHART_H = bottom = ground). */
function ftToY(ft: number): number {
  let cumPx = 0
  for (const band of BANDS) {
    const bandPx = band.pxFraction * CHART_H
    if (ft <= band.to) {
      const frac = (ft - band.from) / (band.to - band.from)
      return CHART_H - (cumPx + bandPx * frac)
    }
    cumPx += bandPx
  }
  return 0  // taller than scale — pin to top
}

/** Human-friendly floor count estimate. */
function floorsText(ft: number): string {
  const floors = Math.round(ft / 10)
  return `about ${floors} typical floor${floors === 1 ? '' : 's'} tall`
}

/** Short label for a reference — abbreviate long names */
function shortName(name: string): string {
  const map: Record<string, string> = {
    'Person': 'Person (5\'10")',
    '3-story Victorian': '3-story Victorian',
    'Coit Tower': 'Coit Tower',
    'One Embarcadero Center': '1 Embarcadero Ctr',
    'Transamerica Pyramid': 'Transamerica Pyramid',
    'Salesforce Tower': 'Salesforce Tower',
  }
  return map[name] ?? name
}

export function HeightContext({ height_ft, districtCode }: Props) {
  if (!height_ft || height_ft <= 0) {
    return (
      <div className="text-[11px] text-ink-faint italic">
        Height not specified for this district — see code section.
      </div>
    )
  }

  const districtLabel = `${districtCode} (${height_ft} ft)`

  const coitTower  = SF_HEIGHT_REFERENCES.find((r) => r.name === 'Coit Tower')
  const salesforce = SF_HEIGHT_REFERENCES.find((r) => r.name === 'Salesforce Tower')
  const coitMultiple = coitTower  ? (coitTower.height_ft  / height_ft).toFixed(1) : null
  const sfMultiple   = salesforce ? (salesforce.height_ft / height_ft).toFixed(1) : null

  const ticks = SF_HEIGHT_REFERENCES.filter((r) => TICK_NAMES.includes(r.name))

  const districtY    = ftToY(height_ft)
  const bandThickness = 4  // px height of district band

  // Resolve label collision: if the district band is within 18px of a tick,
  // push the district label above or below so they don't overlap.
  const tickYs = ticks.map((r) => ftToY(r.height_ft))
  const nearbyTick = tickYs.find((ty) => Math.abs(ty - districtY) < 18)
  const districtLabelY = nearbyTick !== undefined
    ? (districtY < nearbyTick ? districtY - 4 : districtY + 12)
    : districtY - 4

  return (
    <div aria-label={`Height context for ${districtLabel}`}>
      {/* Numeric summary */}
      <div className="text-[11px] text-ink-soft space-y-0.5 mb-3">
        <div>
          <span className="font-semibold text-ink">{districtLabel}</span>
          {' '}— {floorsText(height_ft)}.
        </div>
        {coitMultiple && Number(coitMultiple) > 1 && (
          <div>× {coitMultiple} to reach Coit Tower ({coitTower!.height_ft} ft).</div>
        )}
        {coitMultiple && Number(coitMultiple) <= 1 && (
          <div>Taller than Coit Tower ({coitTower!.height_ft} ft).</div>
        )}
        {sfMultiple && Number(sfMultiple) > 1 && (
          <div>× {sfMultiple} to reach Salesforce Tower ({salesforce!.height_ft} ft).</div>
        )}
        {sfMultiple && Number(sfMultiple) <= 1 && (
          <div>At or above Salesforce Tower ({salesforce!.height_ft} ft) — tallest in SF.</div>
        )}
      </div>

      {/* Thermometer chart — pure SVG, no dangerouslySetInnerHTML */}
      <svg
        width={SVG_W}
        height={CHART_H}
        viewBox={`0 0 ${SVG_W} ${CHART_H}`}
        aria-hidden="true"
        style={{ display: 'block', overflow: 'visible' }}
      >
        {/* Break-axis separator lines (faint, between bands) */}
        {BANDS.slice(0, -1).map((band, i) => {
          const y = ftToY(band.to)
          return (
            <g key={i}>
              <line x1={BAR_X - 4} y1={y} x2={BAR_X + BAR_W + 4} y2={y}
                    stroke="#d6cfbe" strokeWidth="1.5" strokeDasharray="2 3" />
            </g>
          )
        })}

        {/* Vertical thermometer bar */}
        <rect
          x={BAR_X}
          y={0}
          width={BAR_W}
          height={CHART_H}
          fill="#e8e4dc"
          rx={3}
        />

        {/* Filled portion below district height (ground to district level) */}
        <rect
          x={BAR_X}
          y={districtY}
          width={BAR_W}
          height={CHART_H - districtY}
          fill="#c8bfb0"
          rx={3}
        />

        {/* District band — sienna horizontal stripe */}
        <rect
          x={BAR_X - 6}
          y={districtY - bandThickness / 2}
          width={BAR_W + 12}
          height={bandThickness}
          fill="#9a4a31"
          rx={1}
        />

        {/* District label */}
        <text
          x={LABEL_X}
          y={districtLabelY}
          fontSize="10"
          fontWeight="700"
          fill="#9a4a31"
          dominantBaseline="middle"
        >
          {districtLabel}
        </text>

        {/* Reference ticks */}
        {ticks.map((r) => {
          const y = ftToY(r.height_ft)
          // Check if this tick is near the district band — de-emphasise if so
          const isNear = Math.abs(r.height_ft - height_ft) / height_ft < 0.25
          const textFill = isNear ? '#1c2438' : '#5a544c'
          const fontWeight = isNear ? '600' : '400'

          return (
            <g key={r.name}>
              {/* Tick line across the bar */}
              <line
                x1={BAR_X - 4}
                y1={y}
                x2={BAR_X + BAR_W + 4}
                y2={y}
                stroke="#78716c"
                strokeWidth="1"
              />
              {/* Tick height label — left side */}
              <text
                x={BAR_X - 6}
                y={y}
                fontSize="9"
                fill="#78716c"
                textAnchor="end"
                dominantBaseline="middle"
              >
                {r.height_ft < 100 ? r.height_ft : Math.round(r.height_ft)}
              </text>
              {/* Name label — right side */}
              <text
                x={LABEL_X}
                y={y}
                fontSize="10"
                fill={textFill}
                fontWeight={fontWeight}
                dominantBaseline="middle"
              >
                {shortName(r.name)}
              </text>
            </g>
          )
        })}

        {/* Ground line */}
        <line x1={BAR_X - 8} y1={CHART_H} x2={BAR_X + BAR_W + 8} y2={CHART_H}
              stroke="#1c2438" strokeWidth="1.5" />
        <text x={BAR_X + BAR_W / 2} y={CHART_H + 10} fontSize="9" fill="#78716c" textAnchor="middle">
          ground
        </text>
      </svg>
    </div>
  )
}
