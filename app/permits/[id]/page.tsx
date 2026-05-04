import Link from 'next/link'
import { notFound } from 'next/navigation'
import { fetchBuildingPermit, NotFoundError } from '@/lib/datasf'
import { isUnderConstruction, timeAgo } from '@/lib/permit-style'
import { RelatedSources } from '@/components/RelatedSources'

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function dateWithAgo(dateStr: string | null): string {
  if (!dateStr) return '—'
  const ago = timeAgo(dateStr)
  return ago ? `${formatDate(dateStr)} (${ago})` : formatDate(dateStr)
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

  // location is GeoJSON Point: coordinates[0]=lng, coordinates[1]=lat
  const coords = permit.location?.coordinates
  const backHref = coords ? `/?lat=${coords[1]}&lng=${coords[0]}` : '/'

  const underConstruction = isUnderConstruction(permit)
  const isComplete = permit.status === 'complete'
  const issuedAgo = timeAgo(permit.issued_date)

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <Link href={backHref} className="text-blue-600 hover:underline text-sm mb-6 inline-block">
        ← Back to map
      </Link>
      <h1 className="text-2xl font-bold mb-1">{permit.address}</h1>
      <p className="text-gray-500 text-sm mb-4">Building Permit #{permit.permit_number}</p>

      {underConstruction && (
        <div className="mb-6 px-4 py-3 rounded bg-red-50 border border-red-300">
          <div className="font-semibold text-red-700">🚧 Under construction</div>
          {issuedAgo && (
            <div className="text-sm text-red-700/80 mt-1">
              Permit issued {issuedAgo}. SF doesn&apos;t publish formal completion estimates,
              so the finish date isn&apos;t known until inspections sign off.
            </div>
          )}
        </div>
      )}
      {isComplete && permit.completed_date && (
        <div className="mb-6 px-4 py-3 rounded bg-green-50 border border-green-300">
          <div className="font-semibold text-green-700">
            ✓ Completed {formatDate(permit.completed_date)}
          </div>
        </div>
      )}

      <dl className="divide-y divide-gray-100">
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
            <dt className="w-36 shrink-0 text-sm text-gray-500">{label}</dt>
            <dd className="text-sm">{value}</dd>
          </div>
        ))}
      </dl>

      <RelatedSources
        address={permit.address}
        lat={coords?.[1]}
        lng={coords?.[0]}
      />

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
