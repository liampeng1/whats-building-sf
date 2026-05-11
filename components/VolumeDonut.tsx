'use client'

interface Props {
  count: number
  maxCount: number
  /** Diameter of the largest donut in the set (when count === maxCount). */
  maxDiameter?: number
  /** Diameter when count is 0 — minimum visible size. */
  minDiameter?: number
  color?: string
  background?: string
}

/**
 * Small SVG donut whose outer diameter scales with volume (area-proportional
 * so readers perceive it correctly) and whose hole keeps the ring readable at
 * any size. Used in SummaryCard rows to replace the horizontal bar.
 */
export function VolumeDonut({
  count,
  maxCount,
  maxDiameter = 28,
  minDiameter = 10,
  color = '#9a4a31',
  background = '#fbf6ec',
}: Props) {
  const safeMax = Math.max(1, maxCount)
  const ratio = Math.min(1, count / safeMax)
  // Scale diameter by sqrt(ratio) so the *area* (not diameter) tracks volume.
  // Area is what readers perceive as "how much".
  const diameter = minDiameter + Math.sqrt(ratio) * (maxDiameter - minDiameter)
  const r = diameter / 2
  const ringWidth = Math.max(2, diameter * 0.22)
  const innerR = Math.max(0.5, r - ringWidth)

  return (
    <svg
      width={maxDiameter}
      height={maxDiameter}
      viewBox={`0 0 ${maxDiameter} ${maxDiameter}`}
      aria-hidden
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <circle cx={maxDiameter / 2} cy={maxDiameter / 2} r={r} fill={color} opacity={0.85} />
      <circle cx={maxDiameter / 2} cy={maxDiameter / 2} r={innerR} fill={background} />
    </svg>
  )
}
