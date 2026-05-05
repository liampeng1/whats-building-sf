import type { Polygon, MultiPolygon, Position } from 'geojson'

/**
 * Project a GeoJSON Polygon / MultiPolygon into an SVG path string fitted to
 * a rectangular canvas region, preserving aspect ratio (cos-latitude
 * corrected so SF's longitude-vs-latitude scale doesn't squish horizontally).
 *
 * Returns the path "d" attribute. Caller is responsible for stroke / fill.
 */
export function polygonToSvgPath(
  geom: Polygon | MultiPolygon,
  canvas: { x: number; y: number; width: number; height: number },
): string {
  let minLng = Infinity
  let maxLng = -Infinity
  let minLat = Infinity
  let maxLat = -Infinity
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates
  for (const poly of polys) {
    for (const ring of poly) {
      for (const coord of ring) {
        const lng = coord[0]
        const lat = coord[1]
        if (lng < minLng) minLng = lng
        if (lng > maxLng) maxLng = lng
        if (lat < minLat) minLat = lat
        if (lat > maxLat) maxLat = lat
      }
    }
  }
  const dLng = maxLng - minLng
  const dLat = maxLat - minLat
  if (dLng <= 0 || dLat <= 0) return ''
  const cosLat = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180))
  const aspectGeo = (dLng * cosLat) / dLat
  const aspectCanvas = canvas.width / canvas.height
  let scale: number
  let offsetX = 0
  let offsetY = 0
  if (aspectGeo > aspectCanvas) {
    // Geometry wider than canvas — fit to width.
    scale = canvas.width / (dLng * cosLat)
    offsetY = (canvas.height - dLat * scale) / 2
  } else {
    // Taller — fit to height.
    scale = canvas.height / dLat
    offsetX = (canvas.width - dLng * cosLat * scale) / 2
  }

  const project = (coord: Position): [number, number] => [
    canvas.x + offsetX + (coord[0] - minLng) * cosLat * scale,
    canvas.y + offsetY + (maxLat - coord[1]) * scale,
  ]

  let path = ''
  for (const poly of polys) {
    for (const ring of poly) {
      for (let i = 0; i < ring.length; i++) {
        const [x, y] = project(ring[i])
        path += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1)
      }
      path += 'Z'
    }
  }
  return path
}

/**
 * Wraps an SVG path with stroke + fill into a data URL we can hand to an
 * <img> in next/og's ImageResponse — Satori's path support is limited so a
 * data-URL SVG is the most reliable way to render shapes.
 */
export function polygonDataUrl(
  pathD: string,
  width: number,
  height: number,
  opts: { fill: string; fillOpacity: number; stroke: string; strokeWidth: number },
): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><path d="${pathD}" fill="${opts.fill}" fill-opacity="${opts.fillOpacity}" stroke="${opts.stroke}" stroke-width="${opts.strokeWidth}" stroke-linejoin="round" stroke-linecap="round"/></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
