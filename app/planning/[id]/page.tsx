import Link from 'next/link'
import { notFound } from 'next/navigation'
import { fetchPlanningCase, NotFoundError } from '@/lib/datasf'

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default async function PlanningDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let planningCase
  try {
    planningCase = await fetchPlanningCase(decodeURIComponent(id))
  } catch (error) {
    if (error instanceof NotFoundError) notFound()
    throw error
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <Link href="/" className="text-blue-600 hover:underline text-sm mb-6 inline-block">
        ← Back to map
      </Link>
      <h1 className="text-2xl font-bold mb-1">{planningCase.project_address}</h1>
      <p className="text-gray-500 text-sm mb-6">Planning Case #{planningCase.record_id}</p>

      <dl className="divide-y divide-gray-100">
        {([
          ['Type', planningCase.record_type],
          ['Status', planningCase.record_status],
          ['Description', planningCase.description ?? '—'],
          ['Opened', formatDate(planningCase.open_date)],
        ] as [string, string][]).map(([label, value]) => (
          <div key={label} className="py-3 flex gap-4">
            <dt className="w-28 shrink-0 text-sm text-gray-500">{label}</dt>
            <dd className="text-sm">{value}</dd>
          </div>
        ))}
      </dl>

      <a
        href="https://data.sfgov.org/resource/qvu5-m3a2"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-8 inline-block text-xs text-gray-400 hover:text-gray-600"
      >
        View source data on DataSF ↗
      </a>
    </main>
  )
}
