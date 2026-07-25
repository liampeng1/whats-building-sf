import Link from 'next/link'
import type { Polygon, MultiPolygon } from 'geojson'
import { type ActivityEvent, MILESTONE_LABELS, activityScope, formatCostShort } from '@/lib/activity'
import { STAGE_COLORS, timeAgo } from '@/lib/permit-style'
import { ParcelThumb } from './ParcelThumb'

export function mapHref(e: ActivityEvent): string {
  const lat = e.permit.location?.coordinates?.[1]
  const lng = e.permit.location?.coordinates?.[0]
  const id = encodeURIComponent(e.permit.permit_number)
  return lat != null && lng != null ? `/?lat=${lat}&lng=${lng}&permit=${id}` : `/?permit=${id}`
}

/**
 * One enriched, scannable row of the activity feed. Presentational and
 * dependency-free so the server-rendered teaser and the client list share it.
 * Surfaces the milestone, scale/money chips, and permit link — the lead item
 * (ActivityLead) carries the fuller editorial treatment.
 */
export function ActivityRow({
  event,
  now,
  parcel,
}: {
  event: ActivityEvent
  now: Date
  parcel?: Polygon | MultiPolygon
}) {
  const { permit, stage } = event
  const color = STAGE_COLORS[stage] ?? STAGE_COLORS.filed
  const ago = timeAgo(event.eventDate, now)
  const { chips } = activityScope(event)
  const cost = formatCostShort(event.cost)
  const facts = cost ? [...chips, cost] : chips

  return (
    <div className="flex items-start gap-3 border-t border-paper-edge py-3.5">
      {parcel ? (
        <ParcelThumb
          geometry={parcel}
          width={84}
          height={64}
          color={color}
          className="mt-0.5 rounded border border-paper-edge"
        />
      ) : (
        <span
          className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: color.fill, outline: `1px solid ${color.stroke}` }}
          aria-hidden
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="civic-eyebrow text-ink-soft">
          {MILESTONE_LABELS[stage]}
          {ago && <span className="text-ink-faint"> · {ago}</span>}
        </div>
        <Link
          href={mapHref(event)}
          data-testid="activity-address"
          className="mt-0.5 block truncate font-serif text-xl leading-snug text-ink transition-colors hover:text-construction"
        >
          {permit.address}
        </Link>
        {facts.length > 0 && (
          <div className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-ink-soft">
            {facts.map((f, i) => (
              <span key={i} className="whitespace-nowrap">
                {i > 0 && <span className="text-paper-edge">·&nbsp;</span>}
                {f}
              </span>
            ))}
          </div>
        )}
        <div className="mt-1 truncate text-xs text-ink-faint">
          {permit.permit_type_definition ?? 'Building permit'}
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
