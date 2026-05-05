import { ImageResponse } from 'next/og'
import { stageIconSvg, type PermitStage } from '@/lib/permit-style'
import { BRAND_LOGO_DATA_URL } from '@/lib/og-brand'

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = "What's Building SF — every major new-construction permit, mapped"

const STAGES: PermitStage[] = ['filed', 'approved', 'permitted', 'construction', 'complete']

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#fbf6ec',
          display: 'flex',
          flexDirection: 'column',
          padding: '64px 80px',
          color: '#1c2438',
          fontFamily: 'serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={BRAND_LOGO_DATA_URL} width={48} height={48} alt="" />
          <div
            style={{
              fontSize: 20,
              color: '#78716c',
              textTransform: 'uppercase',
              letterSpacing: '0.16em',
              fontFamily: 'sans-serif',
              display: 'flex',
            }}
          >
            San Francisco · Civic Data
          </div>
        </div>

        <div
          style={{
            marginTop: 28,
            fontSize: 132,
            fontWeight: 700,
            lineHeight: 0.95,
            letterSpacing: '-0.02em',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <span style={{ display: 'flex' }}>What&apos;s</span>
          <span style={{ display: 'flex' }}>
            Building <span style={{ color: '#9a4a31' }}>SF</span>
          </span>
        </div>

        <div
          style={{
            marginTop: 32,
            fontSize: 30,
            color: '#475569',
            fontFamily: 'sans-serif',
            lineHeight: 1.3,
            maxWidth: 880,
            display: 'flex',
          }}
        >
          Every major new-construction permit filed in San Francisco in the
          last 2 years, mapped by neighborhood and lifecycle stage.
        </div>

        {/* Stage glyph row — anchors the editorial chrome at the bottom. */}
        <div
          style={{
            marginTop: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 20,
          }}
        >
          {STAGES.map((stage) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={stage}
              src={svgDataUrl(stageIconSvg(stage, 56))}
              width={56}
              height={56}
              alt=""
            />
          ))}
          <div
            style={{
              marginLeft: 'auto',
              fontSize: 22,
              color: '#78716c',
              textTransform: 'uppercase',
              letterSpacing: '0.16em',
              fontFamily: 'sans-serif',
              display: 'flex',
            }}
          >
            whatsbuildingsf.com
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
