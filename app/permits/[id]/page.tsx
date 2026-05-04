import Link from 'next/link'
import { notFound } from 'next/navigation'
import { fetchBuildingPermit, NotFoundError } from '@/lib/datasf'
import { permitStage, timeAgo, STAGE_COLORS, STAGE_LABELS, STAGE_SYMBOLS } from '@/lib/permit-style'
import { RelatedSources } from '@/components/RelatedSources'
import { RelatedArticles } from '@/components/RelatedArticles'

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function dateWithAgo(dateStr: string | null): string {
  if (!dateStr) return '—'
  const ago = timeAgo(dateStr)
  return ago ? `${formatDate(dateStr)} · ${ago}` : formatDate(dateStr)
}

function formatCost(cost: string | null): string {
  if (!cost) return '—'
  const n = Number(cost)
  if (!Number.isFinite(n)) return cost
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
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

  const stage = permitStage(permit.status)
  const stageColor = STAGE_COLORS[stage].fill
  const issuedAgo = timeAgo(permit.issued_date)

  return (
    <main className="max-w-2xl mx-auto px-6 py-10">
      <Link href={backHref} className="civic-eyebrow hover:text-ink mb-8 inline-block">
        ← Back to map
      </Link>

      <div className="civic-eyebrow mb-2">Permit #{permit.permit_number}</div>
      <h1 className="font-serif text-3xl text-ink mb-1 leading-tight">{permit.address}</h1>
      <p className="text-ink-soft text-sm mb-6">
        {permit.permit_type_definition ?? `Type ${permit.permit_type}`}
      </p>

      <div
        className="mb-6 pl-4 py-2 border-l-2"
        style={{ borderColor: stageColor }}
      >
        <div className="font-semibold flex items-center gap-2" style={{ color: stageColor }}>
          <span className="text-lg leading-none">{STAGE_SYMBOLS[stage]}</span>
          <span>
            {stage === 'complete' && permit.completed_date
              ? `Completed ${formatDate(permit.completed_date)}`
              : STAGE_LABELS[stage]}
          </span>
        </div>
        {stage === 'construction' && issuedAgo && (
          <p className="text-sm text-ink-soft mt-1">
            Permit issued {issuedAgo}. DataSF doesn&apos;t publish formal completion
            estimates, so the finish date isn&apos;t known until inspections sign off.
          </p>
        )}
      </div>

      <dl className="divide-y divide-paper-edge border-y border-paper-edge">
        {([
          ['Type', permit.permit_type_definition ?? permit.permit_type],
          ['Status', permit.status],
          ['Description', permit.description ?? '—'],
          ['Estimated cost', formatCost(permit.estimated_cost)],
          ['Filed', formatDate(permit.filed_date)],
          ['Issued', dateWithAgo(permit.issued_date)],
          ['Completed', dateWithAgo(permit.completed_date)],
          ['Last status change', dateWithAgo(permit.status_date)],
        ] as [string, string][]).map(([label, value]) => (
          <div key={label} className="py-3 flex gap-4">
            <dt className="w-40 shrink-0 civic-eyebrow pt-0.5">{label}</dt>
            <dd className="text-sm text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-10">
        <div className="civic-eyebrow mb-3">In the news</div>
        <RelatedArticles address={permit.address} />
      </section>

      <RelatedSources
        address={permit.address}
        lat={coords?.[1]}
        lng={coords?.[0]}
      />

      <a
        href="https://data.sfgov.org/Housing-and-Buildings/Building-Permits/i98e-djp9"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-8 inline-block text-xs text-ink-faint hover:text-ink-soft"
      >
        View source data on DataSF ↗
      </a>
    </main>
  )
}
