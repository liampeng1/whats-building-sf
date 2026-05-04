'use client'
import Link from 'next/link'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  void error
  return (
    <main className="max-w-2xl mx-auto px-4 py-8 text-center">
      <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
      <p className="text-gray-500 mb-6">Could not load data from DataSF.</p>
      <div className="flex gap-4 justify-center">
        <button onClick={reset} className="text-blue-600 hover:underline">
          Try again
        </button>
        <Link href="/" className="text-blue-600 hover:underline">
          Back to map
        </Link>
      </div>
    </main>
  )
}
