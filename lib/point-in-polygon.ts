/**
 * Ray-casting point-in-polygon test. Handles GeoJSON Polygon and MultiPolygon
 * geometries. Returns true if the point is inside any of the polygons (or any
 * of a MultiPolygon's parts).
 *
 * Coordinates are GeoJSON [lng, lat] order.
 */

// Compatible with GeoJSON Position (number[]) — only first 2 elements (lng, lat)
// are used. Any altitude/M coordinates beyond index 1 are ignored.
type Position = number[]
type Ring = Position[]

/** Standard ray-cast for a single ring (linear-ring of [lng,lat] pairs). */
function pointInRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0]
    const yi = ring[i][1]
    const xj = ring[j][0]
    const yj = ring[j][1]
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi || Number.EPSILON) + xi
    if (intersect) inside = !inside
  }
  return inside
}

/** Polygon = outer ring + optional holes. Inside = inside outer AND outside all holes. */
function pointInPolygon(lng: number, lat: number, polygon: Ring[]): boolean {
  if (polygon.length === 0) return false
  if (!pointInRing(lng, lat, polygon[0])) return false
  for (let i = 1; i < polygon.length; i++) {
    if (pointInRing(lng, lat, polygon[i])) return false
  }
  return true
}

export type GeoPolygon = Ring[]
export type GeoMultiPolygon = Ring[][]

export function pointInGeometry(
  lng: number,
  lat: number,
  geometry: { type: string; coordinates: GeoPolygon | GeoMultiPolygon },
): boolean {
  if (geometry.type === 'Polygon') {
    return pointInPolygon(lng, lat, geometry.coordinates as GeoPolygon)
  }
  if (geometry.type === 'MultiPolygon') {
    for (const poly of geometry.coordinates as GeoMultiPolygon) {
      if (pointInPolygon(lng, lat, poly)) return true
    }
  }
  return false
}
