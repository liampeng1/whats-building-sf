import { redirect } from 'next/navigation'

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
