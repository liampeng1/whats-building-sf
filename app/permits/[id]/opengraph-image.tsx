import { ImageResponse } from 'next/og'
import type { Polygon, MultiPolygon } from 'geojson'
import { fetchBuildingPermit } from '@/lib/datasf'
import {
  permitStage,
  netDelta,
  STAGE_COLORS,
  STAGE_LABELS,
} from '@/lib/permit-style'
import { polygonToSvgPath, polygonDataUrl } from '@/lib/og-polygon'

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = "What's Building SF · permit detail"

interface ParcelRow {
  shape?: Polygon | MultiPolygon
}

async function fetchParcel(
  block: string,
  lot: string,
): Promise<Polygon | MultiPolygon | null> {
  if (!/^[0-9A-Z]+$/i.test(block) || !/^[0-9A-Z]+$/i.test(lot)) return null
  const params = new URLSearchParams({
    $select: 'shape',
    $where: `block_num='${block.toUpperCase()}' AND lot_num='${lot.toUpperCase()}'`,
    $limit: '1',
  })
  const headers: Record<string, string> = {}
  if (process.env.DATASF_APP_TOKEN) headers['X-App-Token'] = process.env.DATASF_APP_TOKEN
  try {
    const res = await fetch(
      `https://data.sfgov.org/resource/acdm-wktn.json?${params}`,
      { headers, next: { revalidate: 86400 } },
    )
    if (!res.ok) return null
    const rows: ParcelRow[] = await res.json()
    return rows[0]?.shape ?? null
  } catch {
    return null
  }
}

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // Best-effort fetch — if the permit lookup fails we still render a
  // tasteful fallback rather than crashing the share preview.
  let address = '—'
  let permitNumber = id
  let stageLabel: string | null = null
  let stageColor: string | null = null
  let homes = 0
  let parcelShape: Polygon | MultiPolygon | null = null
  try {
    const permit = await fetchBuildingPermit(id)
    address = permit.address || address
    permitNumber = permit.permit_number || id
    const stage = permitStage(permit)
    stageLabel = STAGE_LABELS[stage].split(' / ')[0].split(' · ')[0]
    stageColor = STAGE_COLORS[stage].fill
    homes = netDelta(permit.existing_units, permit.proposed_units) ?? 0
    if (permit.block && permit.lot) {
      parcelShape = await fetchParcel(permit.block, permit.lot)
    }
  } catch {
    // Fall through to default card.
  }

  // Polygon area centered in the upper portion of the card so address +
  // metadata can sit cleanly underneath. 540 wide × 320 tall.
  const polyW = 540
  const polyH = 320
  const polyX = (size.width - polyW) / 2
  const polyY = 96
  const pathD = parcelShape
    ? polygonToSvgPath(parcelShape, { x: 0, y: 0, width: polyW, height: polyH })
    : ''
  const polyDataUrl = pathD
    ? polygonDataUrl(pathD, polyW, polyH, {
        fill: '#b08968',
        fillOpacity: 0.45,
        stroke: '#9a4a31',
        strokeWidth: 6,
      })
    : null

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#fbf6ec',
          display: 'flex',
          flexDirection: 'column',
          padding: '48px 64px',
          color: '#1c2438',
          fontFamily: 'serif',
        }}
      >
        {/* Eyebrow row: brand + permit id */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 18,
            color: '#78716c',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            fontFamily: 'sans-serif',
          }}
        >
          <div style={{ display: 'flex' }}>What&apos;s Building SF</div>
          <div style={{ display: 'flex' }}>Permit #{permitNumber}</div>
        </div>

        {/* Polygon hero */}
        <div
          style={{
            position: 'absolute',
            left: polyX,
            top: polyY,
            width: polyW,
            height: polyH,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {polyDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={polyDataUrl} width={polyW} height={polyH} alt="" />
          ) : (
            // Fallback when no parcel polygon is available — a paper plate
            // with a soft amber circle so the card still has visual weight.
            <div
              style={{
                width: 240,
                height: 240,
                borderRadius: '50%',
                background: '#b08968',
                opacity: 0.35,
                display: 'flex',
              }}
            />
          )}
        </div>

        {/* Bottom block: address + stage chip + homes */}
        <div
          style={{
            marginTop: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div
            style={{
              fontSize: 64,
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: '-0.01em',
              maxWidth: '100%',
              display: 'flex',
            }}
          >
            {address}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            {stageLabel && stageColor && (
              <div
                style={{
                  background: stageColor,
                  color: '#fbf6ec',
                  padding: '6px 16px',
                  borderRadius: 4,
                  fontSize: 22,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  fontFamily: 'sans-serif',
                  display: 'flex',
                }}
              >
                {stageLabel}
              </div>
            )}
            {homes > 0 && (
              <div
                style={{
                  fontSize: 32,
                  fontWeight: 600,
                  color: '#9a4a31',
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 8,
                }}
              >
                <span style={{ fontFamily: 'serif', display: 'flex' }}>+{homes}</span>
                <span
                  style={{
                    fontSize: 18,
                    fontFamily: 'sans-serif',
                    color: '#78716c',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    display: 'flex',
                  }}
                >
                  net new homes
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
