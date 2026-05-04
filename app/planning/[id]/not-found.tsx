import Link from 'next/link'

export default function PlanningNotFound() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-8 text-center">
      <h1 className="text-2xl font-bold mb-2">Planning case not found</h1>
      <p className="text-gray-500 mb-6">This case may have been removed from DataSF.</p>
      <Link href="/" className="text-blue-600 hover:underline">← Back to map</Link>
    </main>
  )
}
