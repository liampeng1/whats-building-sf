import Link from 'next/link'
import { notFound } from 'next/navigation'
import { fetchBuildingPermit, NotFoundError } from '@/lib/datasf'

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
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

  // location is GeoJSON Point: coordinates[0]=lng, coordinates[1]=lat
  const coords = permit.location?.coordinates
  const backHref = coords ? `/?lat=${coords[1]}&lng=${coords[0]}` : '/'

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <Link href={backHref} className="text-blue-600 hover:underline text-sm mb-6 inline-block">
        ← Back to map
      </Link>
      <h1 className="text-2xl font-bold mb-1">{permit.address}</h1>
      <p className="text-gray-500 text-sm mb-6">Building Permit #{permit.permit_number}</p>

      <dl className="divide-y divide-gray-100">
        {([
          ['Type', permit.permit_type_definition ?? permit.permit_type],
          ['Status', permit.status],
          ['Description', permit.description ?? '—'],
          ['Filed', formatDate(permit.filed_date)],
          ['Issued', formatDate(permit.issued_date)],
          ['Completed', formatDate(permit.completed_date)],
        ] as [string, string][]).map(([label, value]) => (
          <div key={label} className="py-3 flex gap-4">
            <dt className="w-28 shrink-0 text-sm text-gray-500">{label}</dt>
            <dd className="text-sm">{value}</dd>
          </div>
        ))}
      </dl>

      <a
        href="https://data.sfgov.org/Housing-and-Buildings/Building-Permits/i98e-djp9"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-8 inline-block text-xs text-gray-400 hover:text-gray-600"
      >
        View source data on DataSF ↗
      </a>
    </main>
  )
}
