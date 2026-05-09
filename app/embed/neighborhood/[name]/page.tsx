import type { Metadata } from 'next'
import type { FeatureCollection, Polygon, MultiPolygon } from 'geojson'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { Logo } from '@/components/Logo'
import { fetchBuildingPermits } from '@/lib/datasf'
import { pointInGeometry } from '@/lib/point-in-polygon'
import {
  permitStage,
  netDelta,
  STAGE_COLORS,
  STAGE_LABELS,
  STAGE_ORDER,
  type PermitStage,
} from '@/lib/permit-style'

export const revalidate = 21600

const PIPELINE_STAGES: PermitStage[] = STAGE_ORDER.filter((s) => s !== 'inactive')

type NhoodGeo = FeatureCollection<MultiPolygon | Polygon, { nhood: string }>

async function loadNhoodGeo(): Promise<NhoodGeo | null> {
  try {
    const buf = await fs.readFile(
      path.join(process.cwd(), 'public', 'sf-neighborhoods.geojson'),
      'utf8',
    )
    return JSON.parse(buf) as NhoodGeo
  } catch {
    return null
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string }>
}): Promise<Metadata> {
  const { name } = await params
  const decoded = decodeURIComponent(name)
  return {
    title: `${decoded} · embed`,
    description: `Active building permits in ${decoded}, San Francisco. Refreshed nightly.`,
    robots: { index: false, follow: false },
  }
}

export default async function EmbedNeighborhood({
  params,
}: {
  params: Promise<{ name: string }>
}) {
  const { name } = await params
  const decoded = decodeURIComponent(name)
  const geo = await loadNhoodGeo()
  const feature = geo?.features.find(
    (f) => f.properties?.nhood?.toLowerCase() === decoded.toLowerCase(),
  )
  const canonicalName = feature?.properties?.nhood ?? decoded
  const linkUrl = `https://whatsbuildingsf.com/?nhood=${encodeURIComponent(canonicalName)}`

  // Pull a tracked-permit slice and filter to this neighborhood.
  const allPermits = await fetchBuildingPermits(2, 0)
  const permits = feature
    ? allPermits.filter((p) => {
        if (!p.location) return false
        const [lng, lat] = p.location.coordinates
        return pointInGeometry(lng, lat, feature.geometry)
      })
    : []

  let totalHomes = 0
  let totalCost = 0
  const stageCounts = new Map<PermitStage, number>()
  for (const p of permits) {
    const stage = permitStage(p)
    stageCounts.set(stage, (stageCounts.get(stage) ?? 0) + 1)
    const homes = netDelta(p.existing_units, p.proposed_units)
    if (homes != null && homes > 0) totalHomes += homes
    const c = Number(p.estimated_cost ?? 0)
    if (Number.isFinite(c)) totalCost += c
  }
  const total = permits.length
  const maxStage = Math.max(1, ...stageCounts.values())

  return (
    <main className="min-h-screen bg-paper">
      <a
        href={linkUrl}
        target="_top"
        rel="noopener"
        className="block bg-paper border-2 border-ink rounded-md shadow-sm p-5 hover:bg-paper-deep transition-colors"
      >
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 civic-eyebrow text-ink-faint">
            <Logo size={16} variant="on-paper" />
            <span>What&apos;s Building SF</span>
          </div>
          <span className="text-[11px] uppercase tracking-wider text-ink-faint">
            Refreshed nightly
          </span>
        </div>

        <div className="font-serif text-3xl text-ink leading-none tracking-tight mb-1">
          {canonicalName}
        </div>
        <div className="text-xs text-ink-soft uppercase tracking-wider mb-5">
          Neighborhood · San Francisco
        </div>

        <div className="grid grid-cols-3 gap-4 mb-5">
          <div>
            <div className="civic-eyebrow mb-1">Active permits</div>
            <div className="font-serif text-2xl text-ink leading-none">{total}</div>
          </div>
          <div>
            <div className="civic-eyebrow mb-1">Net new homes</div>
            <div className="font-serif text-2xl text-construction leading-none">
              +{totalHomes}
            </div>
          </div>
          <div>
            <div className="civic-eyebrow mb-1">Combined cost</div>
            <div className="font-serif text-2xl text-ink leading-none">
              {totalCost > 0
                ? totalCost >= 1_000_000_000
                  ? `$${(totalCost / 1_000_000_000).toFixed(1)}B`
                  : totalCost >= 1_000_000
                    ? `$${(totalCost / 1_000_000).toFixed(1)}M`
                    : '—'
                : '—'}
            </div>
          </div>
        </div>

        {total > 0 && (
          <ul className="space-y-1.5 mb-3">
            {PIPELINE_STAGES.map((stage) => {
              const count = stageCounts.get(stage) ?? 0
              if (count === 0) return null
              const color = STAGE_COLORS[stage].fill
              const label = STAGE_LABELS[stage].split(' / ')[0].split(' · ')[0]
              const widthPct = (count / maxStage) * 100
              return (
                <li
                  key={stage}
                  className="grid grid-cols-[5.5rem_3rem_1fr] items-center gap-2 text-xs"
                >
                  <span className="text-ink-soft uppercase tracking-wide truncate">
                    {label}
                  </span>
                  <span
                    className="font-semibold tabular-nums text-right"
                    style={{ color }}
                  >
                    {count}
                  </span>
                  <span
                    className="h-2 rounded"
                    style={{
                      width: `${widthPct}%`,
                      backgroundColor: color,
                      opacity: 0.6,
                    }}
                  />
                </li>
              )
            })}
          </ul>
        )}

        {total === 0 && (
          <p className="text-sm text-ink-faint italic">
            No active permits in this neighborhood right now.
          </p>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-paper-edge text-[11px]">
          <span className="text-ink-faint">View interactive map →</span>
          <span className="text-ink-faint font-mono">whatsbuildingsf.com</span>
        </div>
      </a>
    </main>
  )
}
