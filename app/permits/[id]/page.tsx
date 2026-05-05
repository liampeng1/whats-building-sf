import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { fetchBuildingPermit, NotFoundError } from '@/lib/datasf'
import { PermitDetailContent } from '@/components/PermitDetailContent'
import { Logo } from '@/components/Logo'
import {
  permitStage,
  netDelta,
  STAGE_LABELS,
} from '@/lib/permit-style'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  try {
    const permit = await fetchBuildingPermit(id)
    const stage = permitStage(permit)
    const stageLabel = STAGE_LABELS[stage].split(' / ')[0].split(' · ')[0]
    const homes = netDelta(permit.existing_units, permit.proposed_units) ?? 0
    const homesPart = homes > 0 ? ` · +${homes} net new homes` : ''
    const title = permit.address || `Permit #${permit.permit_number}`
    const description = `${stageLabel}${homesPart}. ${permit.permit_type_definition ?? 'Building permit'} in San Francisco.`
    return {
      title,
      description,
      openGraph: { title, description, type: 'article' },
      twitter: { card: 'summary_large_image', title, description },
    }
  } catch {
    return { title: `Permit #${id}` }
  }
}

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
          <div className="flex items-center gap-2 civic-eyebrow text-ink-faint">
            <Logo size={20} variant="on-paper" />
            <span>What&apos;s Building SF · Permit Record</span>
          </div>
        </div>
      </div>

      <article className="max-w-3xl mx-auto px-6 py-10">
        <PermitDetailContent permit={permit} variant="page" />
      </article>
    </main>
  )
}
