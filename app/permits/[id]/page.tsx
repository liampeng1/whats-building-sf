import Link from 'next/link'
import { notFound } from 'next/navigation'
import { fetchBuildingPermit, NotFoundError } from '@/lib/datasf'
import { PermitDetailContent } from '@/components/PermitDetailContent'

export default async function PermitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let permit
  try {
    permit = await fetchBuildingPermit(id)
  } catch (error) {
    if (error instanceof NotFoundError) notFound()
    throw error
  }

  const coords = permit.location?.coordinates
  const backHref = coords ? `/?lat=${coords[1]}&lng=${coords[0]}` : '/'

  return (
    <main className="min-h-screen bg-paper">
      <div className="border-b-2 border-ink bg-paper-deep">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href={backHref} className="civic-eyebrow hover:text-ink transition-colors">
            ← Back to map
          </Link>
          <div className="civic-eyebrow text-ink-faint">What&apos;s Building SF · Permit Record</div>
        </div>
      </div>

      <article className="max-w-3xl mx-auto px-6 py-10">
        <PermitDetailContent permit={permit} variant="page" />
      </article>
    </main>
  )
}
