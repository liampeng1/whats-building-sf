'use client'
import { LensInfoPanel } from './LensInfoPanel'
import { getZoningRecord } from '@/lib/zoning-rules'
import { eligibleLaws } from '@/lib/family-zoning'
import { Glossary } from './Glossary'
import { HeightContext } from './HeightContext'
import { getZoningBlurb } from '@/lib/zoning-blurbs'

interface Props {
  zoningSim: string | null
  gen: string | null
  districtName?: string
  codeSection?: string
  heightFt?: number
  bulk?: string
  permitCountInDistrict?: number
  onClose: () => void
  onDrillToDistrict?: (zoningSim: string) => void
}

export function ZoningDistrictPanel({
  zoningSim, gen, districtName, codeSection, heightFt, bulk,
  permitCountInDistrict = 0,
  onClose,
  onDrillToDistrict,
}: Props) {
  const open = !!zoningSim
  const rec = zoningSim ? getZoningRecord(zoningSim) : null
  const laws = zoningSim && gen ? eligibleLaws(zoningSim, gen) : []
  const blurb = gen ? getZoningBlurb(gen) : ''

  const eyebrowLabel = districtName ?? 'Zoning district'
  const subtitleParts = [gen ?? undefined, codeSection ? `§${codeSection}` : undefined].filter(Boolean)
  const subtitleText = subtitleParts.length > 0 ? subtitleParts.join(' · ') : undefined

  if (!zoningSim) {
    return (
      <LensInfoPanel
        open={open}
        eyebrow="Zoning district"
        title="—"
        primary={{ eyebrow: 'Rules', rows: [] }}
        onClose={onClose}
      />
    )
  }

  if (!rec) {
    // Polygon clicked but no record in the lookup. Shouldn't happen at
    // runtime (build asserts coverage), but degrade gracefully if it does.
    return (
      <LensInfoPanel
        open={open}
        eyebrow={eyebrowLabel}
        title={zoningSim}
        subtitle={subtitleText}
        hero={
          heightFt
            ? { eyebrow: 'Max height', value: `${heightFt} ft`, detail: bulk ? `bulk ${bulk}` : '' }
            : undefined
        }
        primary={{ eyebrow: 'Rules', rows: [] }}
        onClose={onClose}
      />
    )
  }

  // Rule rows — only include fields with usable values; otherwise the row
  // would just print "undefined".
  const ruleRows: { label: string; value: string; pct: number; color: string }[] = []
  if (heightFt) {
    ruleRows.push({
      label: `Height: ${heightFt} ft${bulk ? ` (bulk ${bulk})` : ''}`,
      value: '',
      pct: 1,
      color: '#7d9b76',
    })
  }
  if (rec.density.units_per_lot != null) {
    ruleRows.push({
      label: `Density: ${rec.density.units_per_lot} unit(s) per lot`,
      value: '',
      pct: 1,
      color: '#7d9b76',
    })
  } else if (rec.density.du_per_acre != null) {
    ruleRows.push({
      label: `Density: ${rec.density.du_per_acre} DU/acre`,
      value: '',
      pct: 1,
      color: '#7d9b76',
    })
  } else if (rec.density.note) {
    ruleRows.push({
      label: `Density: ${rec.density.note}`,
      value: '',
      pct: 0.5,
      color: '#7d9b76',
    })
  }
  if (rec.far?.max) {
    ruleRows.push({
      label: `FAR cap: ${rec.far.max}`,
      value: '',
      pct: 1,
      color: '#7d9b76',
    })
  }
  if (rec.parking_min.residential) {
    ruleRows.push({
      label: `Parking (resi): ${rec.parking_min.residential}`,
      value: '',
      pct: 0.7,
      color: '#b08968',
    })
  }
  if (rec.parking_min.commercial) {
    ruleRows.push({
      label: `Parking (commercial): ${rec.parking_min.commercial}`,
      value: '',
      pct: 0.7,
      color: '#b08968',
    })
  }
  if (rec.principal_uses.length > 0) {
    ruleRows.push({
      label: `Uses: ${rec.principal_uses.slice(0, 3).join(', ')}${rec.principal_uses.length > 3 ? '…' : ''}`,
      value: '',
      pct: 0.6,
      color: '#5d7a99',
    })
  }

  return (
    <LensInfoPanel
      open={open}
      eyebrow={eyebrowLabel}
      title={zoningSim}
      subtitle={subtitleText}
      hero={
        heightFt
          ? { eyebrow: 'Max height', value: `${heightFt} ft`, detail: bulk ? `bulk ${bulk}` : '' }
          : undefined
      }
      primary={{ eyebrow: 'Rules', rows: ruleRows }}
      onClose={onClose}
    >
      {/* Extended content — editorial context, height chart, glossary, sources */}
      {blurb && (
        <div className="pt-5 border-t border-paper-edge">
          <p className="text-ink-soft italic leading-relaxed text-sm">{blurb}</p>
        </div>
      )}

      {laws.length > 0 && (
        <div className="mt-4 pt-4 border-t border-paper-edge">
          <div className="civic-eyebrow mb-2">State-law uplift</div>
          <ul className="space-y-3">
            {laws.map((l) => (
              <li key={l.law} className="border-l-2 pl-3" style={{ borderColor: '#9a4a31' }}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-serif text-[14px] text-ink">{l.law}</span>
                  <a
                    href={l.source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] uppercase tracking-wider text-ink-faint hover:text-ink"
                  >
                    {l.source.cite} ↗
                  </a>
                </div>
                <p className="text-[12px] text-ink-soft leading-snug mt-1">{l.uplift_summary}</p>
                <p className="text-[11px] text-ink-faint leading-relaxed mt-1">{l.description}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {heightFt && heightFt > 0 && (
        <div className="pt-5 border-t border-paper-edge">
          <div className="civic-eyebrow mb-3">Height in context</div>
          <HeightContext height_ft={heightFt} districtCode={zoningSim} />
        </div>
      )}

      <div className="pt-5 border-t border-paper-edge text-ink-soft text-[11px] leading-snug">
        Common terms:{' '}
        <Glossary term="FAR" />,{' '}
        <Glossary term="density" />,{' '}
        <Glossary term="setback" />,{' '}
        <Glossary term="lot coverage" />,{' '}
        <Glossary term="principal use" />,{' '}
        <Glossary term="ADU" />.
      </div>

      {permitCountInDistrict > 0 && onDrillToDistrict && (
        <div className="pt-3">
          <button
            type="button"
            onClick={() => onDrillToDistrict(zoningSim)}
            className="block w-full px-2 py-1.5 text-[11px] uppercase tracking-wider rounded border border-paper-edge hover:border-ink text-ink"
          >
            {permitCountInDistrict} permits in {zoningSim} currently visible →
          </button>
        </div>
      )}

      <div className="pt-5 border-t border-paper-edge text-[10px] text-ink-faint space-y-1">
        <div className="uppercase tracking-wider mb-1">Sources</div>
        {rec?.source && (
          <a
            href={rec.source.density.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block hover:text-ink"
          >
            SF Planning Code {rec.source.density.section} ↗
          </a>
        )}
        <a
          href="https://sfplanninggis.org/pim/"
          target="_blank"
          rel="noopener noreferrer"
          className="block hover:text-ink"
        >
          View on SF Property Information Map ↗
        </a>
        <a
          href="https://data.sfgov.org/Geographic-Locations-and-Boundaries/Zoning-Districts/3i4a-hu95"
          target="_blank"
          rel="noopener noreferrer"
          className="block hover:text-ink"
        >
          DataSF: Zoning Districts dataset ↗
        </a>
        <div className="mt-2 leading-snug">
          Gray/uncolored areas on the zoning map are streets (public rights-of-way),
          SF Bay water, or federal/Port-jurisdiction land not covered by the SF Planning
          Code — Presidio (National Park / Presidio Trust), Treasure Island (TIDA), and
          Alcatraz (NPS). These areas are not in the DataSF zoning dataset.
        </div>
      </div>
    </LensInfoPanel>
  )
}
