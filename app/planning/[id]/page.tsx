import Link from 'next/link'
import { notFound } from 'next/navigation'
import { fetchPlanningCase, NotFoundError } from '@/lib/datasf'

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default async function PlanningDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  let planningCase
  try {
    planningCase = await fetchPlanningCase(decodeURIComponent(id))
  } catch (error) {
    if (error instanceof NotFoundError) notFound()
    throw error
  }

  return (
    <main className="min-h-screen bg-paper">
      <div className="border-b-2 border-ink bg-paper-deep">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="civic-eyebrow hover:text-ink transition-colors">
            ← Back to map
          </Link>
          <div className="civic-eyebrow text-ink-faint">
            What&apos;s Building SF · Planning Case
          </div>
        </div>
      </div>

      <article className="max-w-3xl mx-auto px-6 py-10">
        <div className="civic-eyebrow text-ink-faint mb-2">
          Planning Case #{planningCase.record_id}
        </div>
        <h1 className="font-serif text-4xl md:text-5xl text-ink leading-tight tracking-tight">
          {planningCase.project_address}
        </h1>

        <dl className="mt-10 divide-y divide-paper-edge border-y border-paper-edge">
          {(
            [
              ['Type', planningCase.record_type],
              ['Status', planningCase.record_status],
              ['Description', planningCase.description ?? '—'],
              ['Opened', formatDate(planningCase.open_date)],
            ] as [string, string][]
          ).map(([label, value]) => (
            <div key={label} className="py-3 flex gap-6">
              <dt className="w-32 shrink-0 civic-eyebrow text-ink-faint">{label}</dt>
              <dd className="text-sm text-ink leading-snug">{value}</dd>
            </div>
          ))}
        </dl>

        <footer className="mt-12 pt-6 border-t border-paper-edge">
          <a
            href="https://data.sfgov.org/resource/qvu5-m3a2"
            target="_blank"
            rel="noopener noreferrer"
            className="civic-eyebrow text-ink-faint hover:text-ink"
          >
            Source · DataSF Planning Records
          </a>
        </footer>
      </article>
    </main>
  )
}
