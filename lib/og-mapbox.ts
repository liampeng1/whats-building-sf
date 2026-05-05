import type { Polygon, MultiPolygon, Position } from 'geojson'

/**
 * Build a Mapbox Static Images URL with a styled GeoJSON overlay. Returns
 * null when MAPBOX_TOKEN is missing so the caller can fall back to a
 * non-basemap design.
 *
 * Style is mapbox/light-v11 by default — clean paper-and-grey palette
 * that sits well against the cream chrome.
 */
export function buildMapboxStaticUrl({
  geometry,
  width,
  height,
  style = 'mapbox/light-v11',
  retina = true,
  padding = 60,
  fill = '#b08968',
  fillOpacity = 0.45,
  stroke = '#9a4a31',
  strokeWidth = 4,
}: {
  geometry: Polygon | MultiPolygon
  width: number
  height: number
  style?: string
  retina?: boolean
  padding?: number
  fill?: string
  fillOpacity?: number
  stroke?: string
  strokeWidth?: number
}): string | null {
  const token = process.env.MAPBOX_TOKEN
  if (!token) return null

  // simplestyle-spec properties — Mapbox reads these to style the overlay.
  const feature = {
    type: 'Feature' as const,
    properties: {
      stroke,
      'stroke-width': strokeWidth,
      'stroke-opacity': 1,
      fill,
      'fill-opacity': fillOpacity,
    },
    geometry,
  }
  const overlay = `geojson(${encodeURIComponent(JSON.stringify(feature))})`
  const dpr = retina ? '@2x' : ''
  return `https://api.mapbox.com/styles/v1/${style}/static/${overlay}/auto/${width}x${height}${dpr}?padding=${padding}&access_token=${encodeURIComponent(token)}`
}

/**
 * Douglas-Peucker simplification of a single ring. Tolerance is in degrees
 * (squared internally). At SF's latitude, 0.0003° ≈ 33 m — plenty for an
 * OG-image overview. Keeps endpoints unchanged.
 */
function simplifyRing(ring: Position[], tolerance: number): Position[] {
  if (ring.length < 4) return ring
  const sqTol = tolerance * tolerance

  const sqSegDist = (p: Position, a: Position, b: Position): number => {
    let x = a[0]
    let y = a[1]
    let dx = b[0] - x
    let dy = b[1] - y
    if (dx !== 0 || dy !== 0) {
      const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy)
      if (t > 1) {
        x = b[0]
        y = b[1]
      } else if (t > 0) {
        x += dx * t
        y += dy * t
      }
    }
    dx = p[0] - x
    dy = p[1] - y
    return dx * dx + dy * dy
  }

  const last = ring.length - 1
  const simplified: Position[] = [ring[0]]

  const recurse = (first: number, last: number) => {
    let maxSqDist = sqTol
    let index = 0
    for (let i = first + 1; i < last; i++) {
      const d = sqSegDist(ring[i], ring[first], ring[last])
      if (d > maxSqDist) {
        index = i
        maxSqDist = d
      }
    }
    if (maxSqDist > sqTol) {
      if (index - first > 1) recurse(first, index)
      simplified.push(ring[index])
      if (last - index > 1) recurse(index, last)
    }
  }

  recurse(0, last)
  simplified.push(ring[last])
  return simplified
}

/**
 * Simplify a Polygon or MultiPolygon to fit Mapbox's URL length cap. Keeps
 * geometry well-formed (still closed rings, same hole structure).
 */
export function simplifyGeometry(
  geom: Polygon | MultiPolygon,
  tolerance = 0.0003,
): Polygon | MultiPolygon {
  if (geom.type === 'Polygon') {
    return {
      type: 'Polygon',
      coordinates: geom.coordinates.map((ring) => simplifyRing(ring, tolerance)),
    }
  }
  return {
    type: 'MultiPolygon',
    coordinates: geom.coordinates.map((poly) =>
      poly.map((ring) => simplifyRing(ring, tolerance)),
    ),
  }
}
