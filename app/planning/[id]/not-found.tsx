import Link from 'next/link'

export default function PlanningNotFound() {
  return (
    <main className="min-h-screen bg-paper flex flex-col">
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
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-md text-center">
          <h1 className="font-serif text-3xl text-ink mb-2">Planning case not found</h1>
          <p className="text-ink-soft mb-6">
            This case may have been removed from DataSF.
          </p>
          <Link
            href="/"
            className="civic-eyebrow text-ink-faint hover:text-ink transition-colors"
          >
            ← Back to map
          </Link>
        </div>
      </div>
    </main>
  )
}
