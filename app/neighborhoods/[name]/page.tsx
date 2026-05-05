import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string }>
}): Promise<Metadata> {
  const { name } = await params
  const decoded = decodeURIComponent(name)
  const title = `${decoded}`
  const description = `Active building permits and projects in ${decoded}, San Francisco — filed, approved, under construction, and recently complete.`
  return {
    title,
    description,
    openGraph: { title, description, type: 'article' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

/**
 * Canonical URL for a neighborhood share. The actual data view lives on the
 * map (home page) inside the neighborhood side panel — this route exists so
 * shared links unfurl with a per-neighborhood OG image (see
 * opengraph-image.tsx) and so we have a stable URL shape to point shares at.
 *
 * On visit, redirect into the map with the panel pre-opened.
 */
export default async function NeighborhoodPage({
  params,
}: {
  params: Promise<{ name: string }>
}) {
  const { name } = await params
  const decoded = decodeURIComponent(name)
  redirect(`/?nhood=${encodeURIComponent(decoded)}`)
}
