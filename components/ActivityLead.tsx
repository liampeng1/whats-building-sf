import Link from 'next/link'
import type { Polygon, MultiPolygon } from 'geojson'
import { type ActivityEvent, MILESTONE_LABELS, activityScope, formatCostShort } from '@/lib/activity'
import { STAGE_COLORS, timeAgo } from '@/lib/permit-style'
import { mapHref } from './ActivityRow'
import { ParcelThumb } from './ParcelThumb'

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div>
      <div
        className={`font-serif text-3xl leading-none tracking-tight tabular-nums ${
          accent ? 'text-construction' : 'text-ink'
        }`}
      >
        {value}
      </div>
      <div className="civic-eyebrow mt-1 text-ink-faint">{label}</div>
    </div>
  )
}

/**
 * Editorial "lead story" treatment for the single most significant recent
 * event. Bigger address, the scope sentence, and headline stat figures — the
 * magazine-cover moment at the top of the feed.
 */
export function ActivityLead({
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
  const { blurb } = activityScope(event)
  const cost = formatCostShort(event.cost)
  const stories = Number(permit.proposed_stories)
  const hasStories = Number.isFinite(stories) && stories > 0

  const stats: { value: string; label: string; accent?: boolean }[] = []
  if (event.netHomes > 0)
    stats.push({ value: `+${event.netHomes}`, label: 'net homes', accent: true })
  if (hasStories) stats.push({ value: String(stories), label: 'stories' })
  if (cost) stats.push({ value: cost, label: 'est. cost' })

  return (
    <Link
      href={mapHref(event)}
      className="group block border-l-4 bg-paper-deep px-5 py-5 transition-colors hover:bg-paper-edge/40"
      style={{ borderColor: color.fill }}
    >
      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0 flex-1">
          <div className="civic-eyebrow text-ink-soft">
            {MILESTONE_LABELS[stage]}
            {ago && <span className="text-ink-faint"> · {ago}</span>}
          </div>
          <div
            data-testid="activity-address"
            className="mt-1.5 font-serif text-4xl leading-none tracking-tight text-ink transition-colors group-hover:text-construction"
          >
            {permit.address}
          </div>
          {blurb && (
            <p className="mt-3 max-w-xl font-serif text-lg leading-snug text-ink-soft line-clamp-2">
              {blurb}
            </p>
          )}
        </div>
        {parcel && (
          <ParcelThumb
            geometry={parcel}
            width={168}
            height={126}
            color={color}
            className="hidden rounded-md border border-paper-edge sm:block"
          />
        )}
      </div>
      {stats.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-x-10 gap-y-4">
          {stats.map((s) => (
            <Stat key={s.label} {...s} />
          ))}
        </div>
      )}
    </Link>
  )
}
