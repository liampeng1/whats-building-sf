'use client'
import { SF_HEIGHT_REFERENCES } from '@/lib/sf-height-references'

interface Props {
  height_ft: number
  districtCode: string
}

// Break-axis bands. Each band maps a slice of pixel space to a height range.
const BANDS = [
  { from: 0,    to: 50,   pxFraction: 0.30 },   // human / residential
  { from: 50,   to: 250,  pxFraction: 0.20 },   // civic
  { from: 250,  to: 800,  pxFraction: 0.30 },   // mid-tier towers
  { from: 800,  to: 1100, pxFraction: 0.20 },   // Salesforce
] as const

const CHART_HEIGHT_PX = 280
const CHART_WIDTH_PX = 360

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

export function HeightContext({ height_ft, districtCode }: Props) {
  if (!height_ft || height_ft <= 0) {
    return (
      <div className="text-[11px] text-ink-faint italic">
        Height not specified for this district — see codesection.
      </div>
    )
  }

  const bandY = ftToY(height_ft)
  const districtLabel = `${districtCode}: ${height_ft} ft`
  // Bold-emphasize references within ±20% of the district height.
  const proximityThreshold = height_ft * 0.20
  const refs = SF_HEIGHT_REFERENCES.map((r) => ({
    ...r,
    isNear: Math.abs(r.height_ft - height_ft) <= proximityThreshold,
    y: ftToY(r.height_ft),
  }))

  return (
    <div
      className="relative"
      style={{ width: CHART_WIDTH_PX, height: CHART_HEIGHT_PX }}
      aria-label={`Height context for ${districtLabel}`}
    >
      {/* Y-axis tick labels at band boundaries */}
      <svg className="absolute left-0 top-0" width="30" height={CHART_HEIGHT_PX} aria-hidden>
        {BANDS.map((b, i) => {
          const y = ftToY(b.to)
          return (
            <text key={i} x="2" y={y + 4} fontSize="9" fill="#78716c">{b.to} ft</text>
          )
        })}
      </svg>

      {/* Break-axis separators between bands */}
      <svg className="absolute left-[28px] top-0" width={CHART_WIDTH_PX - 28} height={CHART_HEIGHT_PX} aria-hidden>
        {BANDS.slice(0, -1).map((b, i) => {
          const y = ftToY(b.to)
          return (
            <g key={i}>
              <line x1="0" y1={y} x2={CHART_WIDTH_PX - 28} y2={y} stroke="#d6cfbe" strokeWidth="1" strokeDasharray="2 3"/>
              <text x={CHART_WIDTH_PX - 50} y={y - 2} fontSize="10" fill="#78716c">~</text>
            </g>
          )
        })}
      </svg>

      {/* Highlighted district band */}
      <div
        className="absolute"
        style={{
          left: 28,
          right: 0,
          top: bandY - 1,
          height: 3,
          background: '#9a4a31',
          opacity: 0.8,
        }}
      />
      <div
        className="absolute right-0 text-[10px] uppercase tracking-wider font-semibold"
        style={{ top: bandY - 14, color: '#9a4a31' }}
      >
        {districtLabel}
      </div>

      {/* Reference silhouettes — staggered horizontally to reduce overlap */}
      {refs.map((r, i) => {
        const offsetLeft = 40 + (i % 3) * 110
        const labelClass = r.isNear
          ? 'text-[10px] font-semibold text-ink'
          : 'text-[10px] text-ink-soft'
        return (
          <div
            key={r.name}
            className="absolute"
            style={{ left: offsetLeft, top: r.y - 4, transform: 'translateY(-100%)' }}
          >
            <div
              style={{ width: r.width_px, height: 'auto', display: 'inline-block' }}
              dangerouslySetInnerHTML={{ __html: r.illustration }}
            />
            <span className={`block ${labelClass}`} style={{ whiteSpace: 'nowrap' }}>
              {r.name} ({r.height_ft} ft)
            </span>
          </div>
        )
      })}
    </div>
  )
}
