import type { Polygon, MultiPolygon, Position } from 'geojson'

/**
 * Projects an assessor parcel (GeoJSON) into a small slippy-map thumbnail: the
 * set of Web-Mercator raster tiles that cover the framed window, plus an SVG
 * path of the lot outline in the same pixel space. Pure and deterministic —
 * the caller supplies the tile basemap (CARTO, same as the live map) and paints
 * the path. No API key, no network.
 */

const TILE = 256
const DEFAULT_MIN_ZOOM = 14
const DEFAULT_MAX_ZOOM = 19
// Fraction of the canvas the parcel bbox should occupy before we stop zooming
// in — leaves a margin of surrounding streets for context.
const FIT = 0.62

export interface ParcelTile {
  z: number
  x: number
  y: number
  /** Pixel offset of the tile's top-left within the thumbnail. */
  left: number
  top: number
}

export interface ParcelThumbData {
  width: number
  height: number
  /** SVG path "d" of the lot outline, in thumbnail pixel space. */
  path: string
  tiles: ParcelTile[]
}

function lngLatToWorld(lng: number, lat: number, z: number): [number, number] {
  const scale = TILE * 2 ** z
  const x = ((lng + 180) / 360) * scale
  const s = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999)
  const y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale
  return [x, y]
}

function bounds(geom: Polygon | MultiPolygon) {
  let minLng = Infinity
  let maxLng = -Infinity
  let minLat = Infinity
  let maxLat = -Infinity
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates
  for (const poly of polys) {
    for (const ring of poly) {
      for (const [lng, lat] of ring) {
        if (lng < minLng) minLng = lng
        if (lng > maxLng) maxLng = lng
        if (lat < minLat) minLat = lat
        if (lat > maxLat) maxLat = lat
      }
    }
  }
  return { minLng, maxLng, minLat, maxLat, polys }
}

export function buildParcelThumb(
  geom: Polygon | MultiPolygon,
  opts: { width: number; height: number; minZoom?: number; maxZoom?: number },
): ParcelThumbData | null {
  const { width, height } = opts
  const minZoom = opts.minZoom ?? DEFAULT_MIN_ZOOM
  const maxZoom = opts.maxZoom ?? DEFAULT_MAX_ZOOM

  const { minLng, maxLng, minLat, maxLat, polys } = bounds(geom)
  if (!(maxLng > minLng) || !(maxLat > minLat)) return null

  const centerLng = (minLng + maxLng) / 2
  const centerLat = (minLat + maxLat) / 2

  // Largest zoom at which the parcel bbox still fits within FIT of the canvas.
  let z = minZoom
  for (let cand = maxZoom; cand >= minZoom; cand--) {
    const [x0, y0] = lngLatToWorld(minLng, maxLat, cand)
    const [x1, y1] = lngLatToWorld(maxLng, minLat, cand)
    if (Math.abs(x1 - x0) <= width * FIT && Math.abs(y1 - y0) <= height * FIT) {
      z = cand
      break
    }
  }

  const [cx, cy] = lngLatToWorld(centerLng, centerLat, z)
  const originX = cx - width / 2
  const originY = cy - height / 2

  const worldTiles = 2 ** z
  const tiles: ParcelTile[] = []
  const tx0 = Math.floor(originX / TILE)
  const tx1 = Math.floor((originX + width) / TILE)
  const ty0 = Math.floor(originY / TILE)
  const ty1 = Math.floor((originY + height) / TILE)
  for (let tx = tx0; tx <= tx1; tx++) {
    for (let ty = ty0; ty <= ty1; ty++) {
      if (ty < 0 || ty >= worldTiles) continue
      const wx = ((tx % worldTiles) + worldTiles) % worldTiles
      tiles.push({ z, x: wx, y: ty, left: tx * TILE - originX, top: ty * TILE - originY })
    }
  }

  const project = (c: Position): [number, number] => {
    const [x, y] = lngLatToWorld(c[0], c[1], z)
    return [x - originX, y - originY]
  }

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

  return { width, height, path, tiles }
}
