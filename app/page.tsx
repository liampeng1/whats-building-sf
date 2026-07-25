import type { Metadata } from 'next'
import { Suspense } from 'react'
import MapClient from '@/components/MapClient'
import { ActivityTeaser } from '@/components/ActivityTeaser'
import { fetchBuildingPermit } from '@/lib/datasf'
import { permitStage, netDelta, STAGE_LABELS } from '@/lib/permit-style'

const DEFAULT_LAT = 37.7749
const DEFAULT_LNG = -122.4194

function parseCoord(value: string | string[] | undefined, fallback: number): number {
  if (typeof value !== 'string') return fallback
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : fallback
}

function pickString(v: string | string[] | undefined): string | undefined {
  return typeof v === 'string' ? v : undefined
}

/**
 * Map shares now come in three flavors via URL:
 *   /?permit=X (&lat=&lng=)  → permit panel pre-opened
 *   /?nhood=NAME             → neighborhood panel pre-opened
 *   /                        → fresh map
 *
 * Each variant returns its own OG meta + image so unfurls reflect what the
 * recipient will land on, not just a generic site card.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}): Promise<Metadata> {
  const sp = await searchParams
  const permitId = pickString(sp.permit)
  const nhood = pickString(sp.nhood)

  if (permitId) {
    try {
      const permit = await fetchBuildingPermit(permitId)
      const stage = permitStage(permit)
      const stageLabel = STAGE_LABELS[stage].split(' / ')[0].split(' · ')[0]
      const homes = netDelta(permit.existing_units, permit.proposed_units) ?? 0
      const homesPart = homes > 0 ? ` · +${homes} net new homes` : ''
      const title = permit.address || `Permit #${permit.permit_number}`
      const description = `${stageLabel}${homesPart}. ${permit.permit_type_definition ?? 'Building permit'} in San Francisco.`
      // The permit's OG-image route already exists; point both Twitter and
      // Open Graph at it so the unfurl uses the parcel + basemap card.
      const ogImage = { url: `/permits/${encodeURIComponent(permit.permit_number)}/opengraph-image` }
      return {
        title,
        description,
        openGraph: { title, description, type: 'article', images: [ogImage] },
        twitter: { card: 'summary_large_image', title, description, images: [ogImage] },
      }
    } catch {
      // fall through to default below
    }
  }

  if (nhood) {
    const title = nhood
    const description = `Active building permits and projects in ${nhood}, San Francisco — filed, approved, under construction, and recently complete.`
    const ogImage = {
      url: `/neighborhoods/${encodeURIComponent(nhood)}/opengraph-image`,
    }
    return {
      title,
      description,
      openGraph: { title, description, type: 'article', images: [ogImage] },
      twitter: { card: 'summary_large_image', title, description, images: [ogImage] },
    }
  }

  return {}
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
    <main className="relative h-[100dvh] w-full">
      <MapClient initialCenter={[lat, lng]} />
      <Suspense fallback={null}>
        <ActivityTeaser />
      </Suspense>
    </main>
  )
}
