export default function PermitLoading() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mb-6" />
      <div className="h-8 w-64 bg-gray-200 rounded animate-pulse mb-2" />
      <div className="h-4 w-48 bg-gray-200 rounded animate-pulse mb-6" />
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="py-3 flex gap-4">
          <div className="h-4 w-28 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-40 bg-gray-200 rounded animate-pulse" />
        </div>
      ))}
    </main>
  )
}
