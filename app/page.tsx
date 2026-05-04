import MapClient from '@/components/MapClient'

const DEFAULT_LAT = 37.7749
const DEFAULT_LNG = -122.4194

function parseCoord(value: string | string[] | undefined, fallback: number): number {
  if (typeof value !== 'string') return fallback
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : fallback
}

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const sp = await searchParams
  const lat = parseCoord(sp.lat, DEFAULT_LAT)
  const lng = parseCoord(sp.lng, DEFAULT_LNG)

  return (
    <main className="h-[100dvh] w-full">
      <MapClient initialCenter={[lat, lng]} />
    </main>
  )
}
