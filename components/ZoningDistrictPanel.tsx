'use client'
import { LensInfoPanel } from './LensInfoPanel'
import { getZoningRecord } from '@/lib/zoning-rules'
import { eligibleLaws } from '@/lib/family-zoning'
import { Glossary } from './Glossary'
import { HeightContext } from './HeightContext'
import { getZoningBlurb } from '@/lib/zoning-blurbs'
import { VerifiedPanel } from './VerifiedZoningPanel'
import { GOVERNING_PLAN } from '@/lib/zoning-sources'

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

  // Prefer the human-readable district name as the headline; demote the
  // zoning code (e.g. RH-3) to the small eyebrow line. The code alone
  // doesn't mean much to a casual reader — "Residential, Three Family"
  // does.
  const titleLabel = districtName ?? zoningSim ?? ''
  const eyebrowLabel = districtName && zoningSim ? `Zoning district · ${zoningSim}` : 'Zoning district'
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

  // ── Governing-plan fallback ───────────────────────────────────────────────
  // Some districts are governed by a Redevelopment Plan / Design-for-Development
  // / SUD that supersedes the SF Planning Code (Mission Bay, Parkmerced, Hunters
  // Point / Candlestick, Mission Rock, Potrero Power Station, Transbay …). There
  // are no Planning Code rule values to show, so rather than fabricate controls
  // (or surface a stale record), we link the real governing plan. This takes
  // precedence over the record-based rendering below — even a district that still
  // carries a stale record renders the honest plan link.
  const governing = GOVERNING_PLAN[zoningSim]
  if (governing) {
    return (
      <LensInfoPanel
        open={open}
        eyebrow={eyebrowLabel}
        title={titleLabel}
        subtitle={subtitleText}
        hero={
          heightFt
            ? { eyebrow: 'Max height', value: `${heightFt} ft`, detail: bulk ? `bulk ${bulk}` : '' }
            : undefined
        }
        primary={{ eyebrow: 'Rules', rows: [] }}
        onClose={onClose}
      >
        <div className="pt-5 border-t border-paper-edge text-ink-soft text-sm leading-relaxed">
          <p>
            Governed by <strong>{governing.plan}</strong> — this district&rsquo;s controls live
            in a Redevelopment Plan / Design-for-Development that supersedes the SF Planning Code,
            so there are no Planning Code rule values to show.
          </p>
          <a
            href={governing.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-2 text-[12px] uppercase tracking-wider text-ink hover:underline"
          >
            View the governing plan ↗
          </a>
          <a
            href="https://sfplanninggis.org/pim/"
            target="_blank"
            rel="noopener noreferrer"
            className="block mt-1 text-[12px] uppercase tracking-wider text-ink-soft hover:text-ink hover:underline"
          >
            View on SF Property Information Map ↗
          </a>
          <a
            href="https://data.sfgov.org/Geographic-Locations-and-Boundaries/Zoning-Districts/3i4a-hu95"
            target="_blank"
            rel="noopener noreferrer"
            className="block mt-1 text-[12px] uppercase tracking-wider text-ink-soft hover:text-ink hover:underline"
          >
            DataSF: Zoning Districts dataset ↗
          </a>
        </div>
      </LensInfoPanel>
    )
  }

  if (!rec) {
    // No transcribed Planning Code record. Two reasons: (a) TI-* / YBI-*
    // districts are governed by the TIDA Sub-Area Plan, not the SF Planning
    // Code, so there's no §-citation to point at; (b) Planning Code districts
    // we haven't transcribed yet — surface the §codesectio reference + an
    // amlegal link so a reader still has somewhere to go.
    const isTIDA = zoningSim.startsWith('TI-') || zoningSim.startsWith('YBI-')
    return (
      <LensInfoPanel
        open={open}
        eyebrow={eyebrowLabel}
        title={titleLabel}
        subtitle={subtitleText}
        hero={
          heightFt
            ? { eyebrow: 'Max height', value: `${heightFt} ft`, detail: bulk ? `bulk ${bulk}` : '' }
            : undefined
        }
        primary={{ eyebrow: 'Rules', rows: [] }}
        onClose={onClose}
      >
        <div className="pt-5 border-t border-paper-edge text-ink-soft text-sm leading-relaxed">
          {isTIDA ? (
            <>
              <p>
                {zoningSim.startsWith('YBI-') ? 'Yerba Buena Island' : 'Treasure Island'} land use is
                governed by the <strong>Treasure Island / Yerba Buena Island Sub-Area Plan</strong>{' '}
                (administered by TIDA), not the SF Planning Code. Detailed controls live in the
                Design for Development and the Subdivision Code.
              </p>
              <a
                href="https://sfgov.org/treasureisland/development-plan"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-2 text-[12px] uppercase tracking-wider text-ink hover:underline"
              >
                TIDA Sub-Area Plan ↗
              </a>
            </>
          ) : (
            <>
              <p>
                Detailed Planning Code controls for this district haven&rsquo;t been transcribed yet.
                {codeSection ? <> See <strong>§{codeSection}</strong> of the SF Planning Code for
                density, height, FAR, parking, and principal-use limits.</> : <> See the SF Planning
                Code for full controls.</>}
              </p>
              <a
                href={
                  codeSection
                    ? `https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_planning/0-0-0-${codeSection.replace(/[§\s]/g, '')}`
                    : 'https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_planning'
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-2 text-[12px] uppercase tracking-wider text-ink hover:underline"
              >
                {codeSection ? `Planning Code §${codeSection}` : 'SF Planning Code'} ↗
              </a>
              <a
                href="https://sfplanninggis.org/pim/"
                target="_blank"
                rel="noopener noreferrer"
                className="block mt-1 text-[12px] uppercase tracking-wider text-ink-soft hover:text-ink hover:underline"
              >
                View on SF Property Information Map ↗
              </a>
            </>
          )}
        </div>
      </LensInfoPanel>
    )
  }

  // ── Verified records ──────────────────────────────────────────────────────
  // Source-backed residential records (RH/RM/RC/RTO/RED, transcribed verbatim
  // from the SF Planning Code via the §209.x series). Render the NEW rich fields
  // with verbatim quotes behind progressive disclosure + real §-deep-links.
  if (rec.verified) {
    return (
      <VerifiedPanel
        rec={rec}
        open={open}
        eyebrowLabel={eyebrowLabel}
        titleLabel={titleLabel}
        subtitleText={subtitleText}
        heightFt={heightFt}
        bulk={bulk}
        blurb={blurb}
        laws={laws}
        zoningSim={zoningSim}
        permitCountInDistrict={permitCountInDistrict}
        onClose={onClose}
        onDrillToDistrict={onDrillToDistrict}
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
  if (rec.parking_min?.residential) {
    ruleRows.push({
      label: `Parking (resi): ${rec.parking_min.residential}`,
      value: '',
      pct: 0.7,
      color: '#b08968',
    })
  }
  if (rec.parking_min?.commercial) {
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
      title={titleLabel}
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
