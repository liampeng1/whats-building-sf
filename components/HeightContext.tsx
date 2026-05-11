'use client'
import { SF_HEIGHT_REFERENCES } from '@/lib/sf-height-references'

interface Props {
  height_ft: number
  districtCode: string
}

// Use only 6 representative silhouettes to avoid crowding.
// Pick: Person, 3-story Victorian, Coit Tower, One Embarcadero, Transamerica, Salesforce
const DISPLAY_REFS = ['Person', '3-story Victorian', 'Coit Tower', 'One Embarcadero Center', 'Transamerica Pyramid', 'Salesforce Tower']

// Break-axis bands. Each band maps a slice of pixel space to a height range.
const BANDS = [
  { from: 0,    to: 50,   pxFraction: 0.28 },   // human / residential
  { from: 50,   to: 250,  pxFraction: 0.22 },   // civic
  { from: 250,  to: 900,  pxFraction: 0.30 },   // mid-tier towers
  { from: 900,  to: 1100, pxFraction: 0.20 },   // Salesforce
] as const

const CHART_HEIGHT_PX = 240
// Fit within the 520px panel minus 48px padding minus 36px y-axis = ~430px usable
const CHART_WIDTH_PX = 420
const Y_AXIS_WIDTH = 36

/** Map a height in feet to a pixel y-position (0 = top, CHART_HEIGHT_PX = bottom). */
function ftToY(ft: number): number {
  let cumPx = 0
  for (const band of BANDS) {
    const bandPx = band.pxFraction * CHART_HEIGHT_PX
    if (ft <= band.to) {
      const inBandFraction = (ft - band.from) / (band.to - band.from)
      return CHART_HEIGHT_PX - (cumPx + bandPx * inBandFraction)
    }
    cumPx += bandPx
  }
  return 0  // taller than the chart — pin to top
}

/** Human-friendly floor count estimate. */
function floorsText(ft: number): string {
  const floors = Math.round(ft / 10)
  return `about ${floors} typical floor${floors === 1 ? '' : 's'} tall`
}

export function HeightContext({ height_ft, districtCode }: Props) {
  if (!height_ft || height_ft <= 0) {
    return (
      <div className="text-[11px] text-ink-faint italic">
        Height not specified for this district — see code section.
      </div>
    )
  }

  const bandY = ftToY(height_ft)
  const districtLabel = `${districtCode} (${height_ft} ft)`

  // Numeric comparison block
  const coitTower = SF_HEIGHT_REFERENCES.find((r) => r.name === 'Coit Tower')
  const salesforce = SF_HEIGHT_REFERENCES.find((r) => r.name === 'Salesforce Tower')
  const coitMultiple = coitTower ? (coitTower.height_ft / height_ft).toFixed(1) : null
  const sfMultiple = salesforce ? (salesforce.height_ft / height_ft).toFixed(1) : null

  // Bold-emphasize references within ±25% of the district height.
  const proximityThreshold = height_ft * 0.25
  const allRefs = SF_HEIGHT_REFERENCES.map((r) => ({
    ...r,
    isNear: Math.abs(r.height_ft - height_ft) <= proximityThreshold,
    y: ftToY(r.height_ft),
  }))
  const refs = allRefs.filter((r) => DISPLAY_REFS.includes(r.name))

  // Position silhouettes in 3 columns across the chart area
  const chartAreaW = CHART_WIDTH_PX - Y_AXIS_WIDTH
  const colW = Math.floor(chartAreaW / 3)

  return (
    <div aria-label={`Height context for ${districtLabel}`}>
      {/* Numeric summary */}
      <div className="text-[11px] text-ink-soft space-y-0.5 mb-3">
        <div><span className="font-semibold text-ink">{districtLabel}</span> — {floorsText(height_ft)}.</div>
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

      {/* Silhouette chart */}
      <div
        className="relative overflow-hidden"
        style={{ width: CHART_WIDTH_PX, height: CHART_HEIGHT_PX }}
      >
        {/* Y-axis tick labels at band boundaries */}
        <svg className="absolute left-0 top-0" width={Y_AXIS_WIDTH} height={CHART_HEIGHT_PX} aria-hidden>
          {BANDS.map((b, i) => {
            const y = ftToY(b.to)
            return (
              <text key={i} x="2" y={Math.max(10, y + 4)} fontSize="9" fill="#78716c">{b.to} ft</text>
            )
          })}
        </svg>

        {/* Break-axis dashed separators between bands */}
        <svg className="absolute top-0" style={{ left: Y_AXIS_WIDTH }} width={chartAreaW} height={CHART_HEIGHT_PX} aria-hidden>
          {BANDS.slice(0, -1).map((b, i) => {
            const y = ftToY(b.to)
            return (
              <g key={i}>
                <line x1="0" y1={y} x2={chartAreaW} y2={y} stroke="#d6cfbe" strokeWidth="1" strokeDasharray="3 4"/>
                <text x={chartAreaW - 12} y={y - 3} fontSize="11" fill="#a9a29a" fontStyle="italic">~</text>
              </g>
            )
          })}
        </svg>

        {/* Highlighted district band */}
        <div
          className="absolute"
          style={{
            left: Y_AXIS_WIDTH,
            right: 0,
            top: Math.max(2, bandY - 1),
            height: 3,
            background: '#9a4a31',
            opacity: 0.85,
          }}
        />
        <div
          className="absolute text-[9px] uppercase tracking-wider font-semibold"
          style={{
            left: Y_AXIS_WIDTH + 4,
            top: Math.max(2, bandY - 14),
            color: '#9a4a31',
            whiteSpace: 'nowrap',
          }}
        >
          {districtLabel}
        </div>

        {/* Reference silhouettes — 2 per column, staggered to reduce label overlap */}
        {refs.map((r, i) => {
          const col = i % 3
          const row = Math.floor(i / 3)
          const offsetLeft = Y_AXIS_WIDTH + col * colW + (row * 20)
          const topPos = r.y - 4
          const labelClass = r.isNear
            ? 'text-[9px] font-semibold text-ink leading-tight'
            : 'text-[9px] text-ink-soft leading-tight'
          return (
            <div
              key={r.name}
              className="absolute"
              style={{
                left: offsetLeft,
                top: topPos,
                transform: 'translateY(-100%)',
                maxWidth: colW - 4,
              }}
            >
              <div
                style={{ width: Math.min(r.width_px, 32), height: 'auto', display: 'inline-block' }}
                dangerouslySetInnerHTML={{ __html: r.illustration }}
              />
              <span className={`block ${labelClass}`} style={{ whiteSpace: 'nowrap' }}>
                {r.name} ({r.height_ft} ft)
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
