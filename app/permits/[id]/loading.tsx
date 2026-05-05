export default function PermitLoading() {
  return (
    <main className="min-h-screen bg-paper">
      <div className="border-b-2 border-ink bg-paper-deep">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="h-3 w-24 bg-paper-edge rounded animate-pulse" />
          <div className="h-3 w-44 bg-paper-edge rounded animate-pulse" />
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <div className="h-8 w-2/3 bg-paper-edge rounded animate-pulse" />
        <div className="h-4 w-1/3 bg-paper-edge rounded animate-pulse" />
        <div className="space-y-3 pt-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className="h-3 w-28 bg-paper-edge rounded animate-pulse" />
              <div className="h-3 flex-1 max-w-xs bg-paper-edge rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
