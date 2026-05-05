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
import { buildMapboxStaticUrl } from '@/lib/og-mapbox'

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

  // Map area takes the upper 460px; the editorial card sits in the bottom
  // 170px. When MAPBOX_TOKEN is set, the map area is a real basemap with
  // the parcel polygon overlaid; otherwise it's a paper-cream area with
  // just the polygon silhouette (the previous design).
  const MAP_H = 460
  const CARD_H = size.height - MAP_H

  const mapUrl = parcelShape
    ? buildMapboxStaticUrl({
        geometry: parcelShape,
        width: size.width,
        height: MAP_H,
        // Parcels are small — give the basemap room to breathe so streets
        // around the lot show context.
        padding: 80,
      })
    : null

  // Fallback (no Mapbox token): render the polygon-only silhouette like before.
  const fallbackPathD =
    !mapUrl && parcelShape
      ? polygonToSvgPath(parcelShape, { x: 0, y: 0, width: size.width, height: MAP_H })
      : ''
  const fallbackPolyUrl = fallbackPathD
    ? polygonDataUrl(fallbackPathD, size.width, MAP_H, {
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
          display: 'flex',
          flexDirection: 'column',
          background: '#fbf6ec',
          color: '#1c2438',
          fontFamily: 'serif',
        }}
      >
        {/* Map area */}
        <div
          style={{
            width: '100%',
            height: MAP_H,
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#fbf6ec',
            overflow: 'hidden',
          }}
        >
          {mapUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mapUrl} width={size.width} height={MAP_H} alt="" />
          ) : fallbackPolyUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fallbackPolyUrl} width={size.width} height={MAP_H} alt="" />
          ) : (
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

        {/* Editorial card */}
        <div
          style={{
            height: CARD_H,
            padding: '20px 64px 24px',
            background: '#fbf6ec',
            borderTop: '2px solid #1c2438',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 16,
              color: '#78716c',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              fontFamily: 'sans-serif',
            }}
          >
            <div style={{ display: 'flex' }}>What&apos;s Building SF</div>
            <div style={{ display: 'flex' }}>Permit #{permitNumber}</div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: 24,
            }}
          >
            <div
              style={{
                fontSize: 48,
                fontWeight: 600,
                lineHeight: 1.05,
                letterSpacing: '-0.01em',
                display: 'flex',
                flex: 1,
                minWidth: 0,
              }}
            >
              {address}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
              {stageLabel && stageColor && (
                <div
                  style={{
                    background: stageColor,
                    color: '#fbf6ec',
                    padding: '6px 16px',
                    borderRadius: 4,
                    fontSize: 18,
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
                    fontSize: 28,
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
                      fontSize: 14,
                      fontFamily: 'sans-serif',
                      color: '#78716c',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      display: 'flex',
                    }}
                  >
                    homes
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
