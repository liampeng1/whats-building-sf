import Link from 'next/link'
import { fetchBuildingPermits } from '@/lib/datasf'
import { computeActivity, MILESTONE_LABELS } from '@/lib/activity'
import { STAGE_COLORS } from '@/lib/permit-style'

/**
 * Floating "Latest" pill for the map homepage. Shows the single most
 * significant recent milestone as a glanceable headline and links to the full
 * /activity feed — a reason to check without crowding the map.
 *
 * Async server component: rendered inside <Suspense> so it streams in and
 * never blocks the map shell. Fails soft to null on any error/empty window.
 */
export async function ActivityTeaser() {
  let top
  try {
    const permits = await fetchBuildingPermits(2, 0)
    ;[top] = computeActivity(permits, Date.now(), { limit: 1 })
  } catch {
    return null
  }
  if (!top) return null

  const color = STAGE_COLORS[top.stage] ?? STAGE_COLORS.filed
  const dot = (
    <span
      className="h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: color.fill, outline: `1px solid ${color.stroke}` }}
      aria-hidden
    />
  )

  return (
    <>
      {/* Desktop: a headline card top-right, where there's room. */}
      <Link
        href="/activity"
        className="group absolute right-4 top-4 z-[1000] hidden max-w-[20rem] rounded-md border border-paper-edge bg-paper px-3 py-2 shadow-md transition-colors hover:border-ink hover:bg-paper-deep md:block"
        title="See everything that just changed"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="civic-eyebrow text-ink-faint">Latest activity</span>
          <span className="civic-eyebrow text-ink-faint transition-colors group-hover:text-ink">
            See all →
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          {dot}
          <span className="min-w-0 truncate text-sm text-ink">
            <span className="text-ink-soft">{MILESTONE_LABELS[top.stage]}:</span>{' '}
            {top.permit.address}
          </span>
        </div>
      </Link>

      {/* Mobile: a compact pill in the bottom-left stack (above About), since
          the top bar is too contested on small screens. */}
      <Link
        href="/activity"
        className="absolute bottom-28 left-4 z-[1000] flex items-center gap-1.5 rounded-md border border-paper-edge bg-paper px-3 py-2 text-xs font-medium text-ink-soft shadow-md transition-colors hover:border-ink hover:bg-paper-deep hover:text-ink md:hidden"
        title="See everything that just changed"
      >
        {dot}
        <span>Latest activity</span>
        <span aria-hidden>→</span>
      </Link>
    </>
  )
}
