import { ImageResponse } from 'next/og'
import type { FeatureCollection, Polygon, MultiPolygon } from 'geojson'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { polygonToSvgPath, polygonDataUrl } from '@/lib/og-polygon'

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

  // Polygon hero takes the bulk of the canvas — neighborhood silhouettes
  // are recognizable to locals, so we let the shape be the visual.
  const polyW = 720
  const polyH = 380
  const polyX = (size.width - polyW) / 2
  const polyY = 80
  const pathD = feature?.geometry
    ? polygonToSvgPath(feature.geometry, { x: 0, y: 0, width: polyW, height: polyH })
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
        {/* Eyebrow */}
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
          <div style={{ display: 'flex' }}>Neighborhood</div>
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

        {/* Bottom block */}
        <div
          style={{
            marginTop: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div
            style={{
              fontSize: 24,
              color: '#78716c',
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
              fontFamily: 'sans-serif',
              display: 'flex',
            }}
          >
            San Francisco
          </div>
          <div
            style={{
              fontSize: 76,
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
