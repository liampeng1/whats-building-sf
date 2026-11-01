import type { Polygon, MultiPolygon } from 'geojson'
import { buildParcelThumb } from '@/lib/parcel-thumb'

// Same basemap as the interactive map, so thumbnails read as "a piece of the map".
const TILES = 'https://tile.openstreetmap.org'

/**
 * A small map snippet with the parcel outline painted on top — enough street
 * context to see where a project is. Renders nothing when the geometry can't be
 * projected, letting the caller fall back (e.g. to a stage dot).
 */
export function ParcelThumb({
  geometry,
  width,
  height,
  color,
  className = '',
}: {
  geometry: Polygon | MultiPolygon
  width: number
  height: number
  color: { fill: string; stroke: string }
  className?: string
}) {
  const data = buildParcelThumb(geometry, { width, height })
  if (!data) return null

  return (
    <div
      className={`relative shrink-0 overflow-hidden ${className}`}
      style={{ width, height }}
      aria-hidden
    >
      {data.tiles.map((t, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src={`${TILES}/${t.z}/${t.x}/${t.y}.png`}
          alt=""
          loading="lazy"
          width={256}
          height={256}
          style={{ position: 'absolute', left: t.left, top: t.top, maxWidth: 'none' }}
        />
      ))}
      <svg
        width={width}
        height={height}
        style={{ position: 'absolute', inset: 0 }}
        viewBox={`0 0 ${width} ${height}`}
      >
        {/* Light casing lifts the outline off a pale/sparse basemap so large,
            zoomed-out parcels still read clearly; colored line on top. */}
        <path
          d={data.path}
          fill="none"
          stroke="#fbf6ec"
          strokeOpacity={0.9}
          strokeWidth={4}
          strokeLinejoin="round"
        />
        <path
          d={data.path}
          fill={color.fill}
          fillOpacity={0.55}
          stroke={color.stroke}
          strokeWidth={1.75}
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}
