import { buildParcelThumb } from '@/lib/parcel-thumb'
import type { Polygon, MultiPolygon } from 'geojson'

// A square parcel of roughly `meters` on a side, centered on an SF point.
function square(meters: number, lng = -122.4, lat = 37.79): Polygon {
  const dy = meters / 2 / 111320
  const dx = meters / 2 / (111320 * Math.cos((lat * Math.PI) / 180))
  return {
    type: 'Polygon',
    coordinates: [
      [
        [lng - dx, lat - dy],
        [lng + dx, lat - dy],
        [lng + dx, lat + dy],
        [lng - dx, lat + dy],
        [lng - dx, lat - dy],
      ],
    ],
  }
}

function pathPoints(d: string): [number, number][] {
  return [...d.matchAll(/[ML](-?\d+\.?\d*),(-?\d+\.?\d*)/g)].map((m) => [
    Number(m[1]),
    Number(m[2]),
  ])
}

const SIZE = { width: 120, height: 120 }

describe('buildParcelThumb', () => {
  it('returns null for a degenerate (zero-area) geometry', () => {
    const point: Polygon = {
      type: 'Polygon',
      coordinates: [[[-122.4, 37.79], [-122.4, 37.79], [-122.4, 37.79], [-122.4, 37.79]]],
    }
    expect(buildParcelThumb(point, SIZE)).toBeNull()
  })

  it('produces tiles and a closed SVG path fitted to the canvas', () => {
    const data = buildParcelThumb(square(30), SIZE)!
    expect(data).not.toBeNull()
    expect(data.width).toBe(120)
    expect(data.height).toBe(120)
    expect(data.tiles.length).toBeGreaterThanOrEqual(1)
    expect(data.path.startsWith('M')).toBe(true)
    expect(data.path.endsWith('Z')).toBe(true)
  })

  it('keeps the projected parcel inside the canvas, centered', () => {
    const data = buildParcelThumb(square(30), SIZE)!
    const pts = pathPoints(data.path)
    for (const [x, y] of pts) {
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThanOrEqual(120)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(120)
    }
    const xs = pts.map((p) => p[0])
    const ys = pts.map((p) => p[1])
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2
    expect(Math.abs(cx - 60)).toBeLessThan(2)
    expect(Math.abs(cy - 60)).toBeLessThan(2)
  })

  it('zooms in further for a smaller parcel (auto-fit)', () => {
    const small = buildParcelThumb(square(20), SIZE)!
    const large = buildParcelThumb(square(400), SIZE)!
    expect(small.tiles[0].z).toBeGreaterThan(large.tiles[0].z)
  })

  it('handles a MultiPolygon', () => {
    const mp: MultiPolygon = {
      type: 'MultiPolygon',
      coordinates: [square(30).coordinates],
    }
    const data = buildParcelThumb(mp, SIZE)!
    expect(data.path.endsWith('Z')).toBe(true)
  })
})
