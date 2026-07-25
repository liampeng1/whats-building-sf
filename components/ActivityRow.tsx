import Link from 'next/link'
import { type ActivityEvent, MILESTONE_LABELS } from '@/lib/activity'
import { STAGE_COLORS, timeAgo } from '@/lib/permit-style'

function mapHref(e: ActivityEvent): string {
  const lat = e.permit.location?.coordinates?.[1]
  const lng = e.permit.location?.coordinates?.[0]
  const id = encodeURIComponent(e.permit.permit_number)
  return lat != null && lng != null ? `/?lat=${lat}&lng=${lng}&permit=${id}` : `/?permit=${id}`
}

/**
 * One row of the activity feed. Presentational and dependency-free so both the
 * server-rendered teaser and the client-side list can share it.
 */
export function ActivityRow({ event, now }: { event: ActivityEvent; now: Date }) {
  const { permit, stage, netHomes, eventDate } = event
  const color = STAGE_COLORS[stage] ?? STAGE_COLORS.filed
  const ago = timeAgo(eventDate, now)
  const type = permit.permit_type_definition ?? 'Building permit'

  return (
    <div className="flex items-start gap-3 py-3 border-t border-paper-edge">
      <span
        className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: color.fill, outline: `1px solid ${color.stroke}` }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="civic-eyebrow text-ink-soft">{MILESTONE_LABELS[stage]}</span>
          {netHomes > 0 && (
            <span className="text-xs font-medium text-construction tabular-nums">
              +{netHomes} net home{netHomes === 1 ? '' : 's'}
            </span>
          )}
          {ago && <span className="text-xs text-ink-soft">· {ago}</span>}
        </div>
        <Link
          href={mapHref(event)}
          data-testid="activity-address"
          className="block font-serif text-lg leading-snug text-ink hover:text-construction transition-colors truncate"
        >
          {permit.address}
        </Link>
        <div className="mt-0.5 text-xs text-ink-soft truncate">
          {type}
          {' · '}
          <Link
            href={`/permits/${encodeURIComponent(permit.permit_number)}`}
            className="underline decoration-dotted underline-offset-2 hover:text-ink"
          >
            #{permit.permit_number}
          </Link>
        </div>
      </div>
    </div>
  )
}
