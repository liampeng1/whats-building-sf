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

  // Hidden below md: the mobile map top bar (zoom + centered lens rail) is too
  // contested for a floating card. Mobile reaches /activity via other nav.
  return (
    <Link
      href="/activity"
      className="hidden md:block absolute top-4 right-4 z-[1000] max-w-[20rem] bg-paper border border-paper-edge rounded-md shadow-md px-3 py-2 hover:border-ink hover:bg-paper-deep transition-colors group"
      title="See everything that just changed"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="civic-eyebrow text-ink-faint">Latest activity</span>
        <span className="civic-eyebrow text-ink-faint group-hover:text-ink transition-colors">
          See all →
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: color.fill, outline: `1px solid ${color.stroke}` }}
          aria-hidden
        />
        <span className="min-w-0 truncate text-sm text-ink">
          <span className="text-ink-soft">{MILESTONE_LABELS[top.stage]}:</span>{' '}
          {top.permit.address}
        </span>
      </div>
    </Link>
  )
}
