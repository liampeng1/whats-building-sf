import { ImageResponse } from 'next/og'
import type { FeatureCollection, Polygon, MultiPolygon } from 'geojson'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { polygonToSvgPath, polygonDataUrl } from '@/lib/og-polygon'
import { buildMapboxStaticUrl, simplifyGeometry } from '@/lib/og-mapbox'

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = "What's Building SF · neighborhood"

type NhoodGeo = FeatureCollection<MultiPolygon | Polygon, { nhood: string }>

async function loadNeighborhoods(): Promise<NhoodGeo | null> {
  try {
    const filePath = path.join(process.cwd(), 'public', 'sf-neighborhoods.geojson')
    const buf = await fs.readFile(filePath, 'utf8')
    return JSON.parse(buf) as NhoodGeo
  } catch {
    return null
  }
}

export default async function Image({
  params,
}: {
  params: Promise<{ name: string }>
}) {
  const { name } = await params
  const decodedName = decodeURIComponent(name)
  const geo = await loadNeighborhoods()
  const feature = geo?.features.find(
    (f) => f.properties?.nhood?.toLowerCase() === decodedName.toLowerCase(),
  )

  const MAP_H = 460
  const CARD_H = size.height - MAP_H

  // Neighborhood polygons can be 50–500 vertices and would blow past
  // Mapbox's URL length cap if encoded raw — simplify to ~30m tolerance
  // first. The basemap shows the streets so high polygon detail isn't needed.
  const simplified = feature?.geometry ? simplifyGeometry(feature.geometry, 0.0005) : null
  const mapUrl = simplified
    ? buildMapboxStaticUrl({
        geometry: simplified,
        width: size.width,
        height: MAP_H,
        padding: 50,
      })
    : null

  // Fallback to the polygon-only silhouette if no Mapbox token.
  const fallbackPathD =
    !mapUrl && feature?.geometry
      ? polygonToSvgPath(feature.geometry, { x: 0, y: 0, width: size.width, height: MAP_H })
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
        {/* Map / silhouette area */}
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
                width: 320,
                height: 320,
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
            <div style={{ display: 'flex' }}>Neighborhood · San Francisco</div>
          </div>
          <div
            style={{
              fontSize: 56,
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: '-0.01em',
              display: 'flex',
            }}
          >
            {feature ? feature.properties?.nhood : decodedName}
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
