'use client'
import { LensInfoPanel } from './LensInfoPanel'
import { Glossary } from './Glossary'
import { HeightContext } from './HeightContext'
import type { ZoningRecord } from '@/lib/zoning-rules'
import type { FamilyLawEligibility } from '@/lib/family-zoning'
import type { CodeCitation } from '@/lib/zoning-sources'

/** A single source-backed rule row. `quote` (if present) is revealed via a
 *  subtle <details> "what the code says" disclosure — kept collapsed so we
 *  don't dump every verbatim sentence inline. */
function RuleRow({ label, quote }: { label: string; quote?: string }) {
  return (
    <li className="leading-snug">
      <div className="text-sm text-ink">{label}</div>
      {quote && (
        <details className="mt-0.5 group">
          <summary className="cursor-pointer list-none text-[10px] uppercase tracking-wider text-ink-faint hover:text-ink-soft select-none">
            what the code says
          </summary>
          <p className="mt-1 pl-3 border-l border-paper-edge text-[12px] italic text-ink-soft leading-relaxed">
            &ldquo;{quote}&rdquo;
          </p>
        </details>
      )}
    </li>
  )
}

interface VerifiedPanelProps {
  rec: ZoningRecord
  open: boolean
  eyebrowLabel: string
  titleLabel: string
  subtitleText?: string
  heightFt?: number
  bulk?: string
  blurb: string
  laws: FamilyLawEligibility[]
  zoningSim: string
  permitCountInDistrict: number
  onClose: () => void
  onDrillToDistrict?: (zoningSim: string) => void
}

/** Renders a source-verified residential record (RH/RM/RC/RTO/RED) — the rich
 *  fields transcribed verbatim from the SF Planning Code, each with a verbatim
 *  quote behind progressive disclosure and real §-deep-links. */
export function VerifiedPanel({
  rec, open, eyebrowLabel, titleLabel, subtitleText, heightFt, bulk,
  blurb, laws, zoningSim, permitCountInDistrict, onClose, onDrillToDistrict,
}: VerifiedPanelProps) {
  const src = rec.source
  type Row = { label: string; quote?: string }
  const rows: Row[] = []

  // Density — units/lot + per-sf figure, e.g. "3 units/lot or 1 per 600 sq.ft."
  const d = rec.density
  const densityParts: string[] = []
  if (d.units_per_lot != null) densityParts.push(`${d.units_per_lot} unit${d.units_per_lot === 1 ? '' : 's'}/lot`)
  if (d.sqft_per_unit != null) densityParts.push(`1 per ${d.sqft_per_unit.toLocaleString()} sq.ft.`)
  let densityLabel = densityParts.length > 0 ? `Density: ${densityParts.join(' or ')}` : ''
  if (d.cu_pathway) densityLabel += ` (${d.cu_pathway})`
  if (densityLabel) {
    rows.push({ label: densityLabel, quote: src.density?.quote || undefined })
  } else if (d.note) {
    rows.push({ label: `Density: ${d.note}`, quote: src.density?.quote || undefined })
  }

  // FAR (non-residential) — make clear it's the non-dwelling FAR. Omit if absent.
  if (rec.far_non_residential?.max != null) {
    rows.push({
      label: `FAR (non-residential): ${rec.far_non_residential.max}`,
      quote: src.far_non_residential?.quote || undefined,
    })
  }

  // Min lot
  if (rec.min_lot) {
    rows.push({
      label: `Min lot: ${rec.min_lot.width_ft} ft wide / ${rec.min_lot.area_sqft.toLocaleString()} sq.ft.`,
      quote: src.min_lot?.quote || undefined,
    })
  }

  // Open space (private, per unit)
  if (rec.open_space_per_unit?.private_sqft != null) {
    rows.push({
      label: `Open space: ${rec.open_space_per_unit.private_sqft} sq.ft./unit (private)`,
      quote: src.open_space?.quote || undefined,
    })
  }

  // Front setback / Rear yard — verbatim formula text rows.
  if (rec.front_setback_text) {
    rows.push({ label: `Front setback: ${rec.front_setback_text}`, quote: src.front_setback?.quote || undefined })
  }
  if (rec.rear_yard_text) {
    rows.push({ label: `Rear yard: ${rec.rear_yard_text}`, quote: src.rear_yard?.quote || undefined })
  }

  // Dwelling-unit mix / parking (RTO).
  if (rec.dwelling_unit_mix_text) {
    rows.push({ label: `Dwelling-unit mix: ${rec.dwelling_unit_mix_text}`, quote: src.dwelling_unit_mix?.quote || undefined })
  }
  if (rec.parking_text) {
    rows.push({ label: `Parking: ${rec.parking_text}`, quote: src.parking?.quote || undefined })
  }

  // Principal + conditional uses.
  if (rec.principal_uses.length > 0) {
    rows.push({
      label: `Principal uses: ${rec.principal_uses.join('; ')}`,
      quote: src.principal_uses?.quote || undefined,
    })
  }
  if (rec.conditional_uses && rec.conditional_uses.length > 0) {
    rows.push({
      label: `Conditional uses: ${rec.conditional_uses.join('; ')}`,
      quote: src.conditional_uses?.quote || undefined,
    })
  }

  // ── Sources: source document + one de-duplicated §-link per populated field.
  const citations: CodeCitation[] = [
    src.density, src.far_non_residential, src.min_lot, src.open_space,
    src.principal_uses, src.conditional_uses, src.front_setback, src.rear_yard,
    src.dwelling_unit_mix, src.parking,
  ].filter((c): c is CodeCitation => !!c)
  const seenSections = new Set<string>()
  const sectionLinks = citations.filter((c) => {
    if (seenSections.has(c.section)) return false
    seenSections.add(c.section)
    return true
  })

  // At-a-glance bars for the primary block (so it isn't an empty "No data").
  const glanceRows: { label: string; value: string; pct: number; color: string }[] = []
  if (heightFt) {
    glanceRows.push({ label: `Height: ${heightFt} ft${bulk ? ` (bulk ${bulk})` : ''}`, value: '', pct: 1, color: '#7d9b76' })
  }
  if (densityLabel) {
    glanceRows.push({ label: densityLabel, value: '', pct: 1, color: '#7d9b76' })
  }
  if (rec.far_non_residential?.max != null) {
    glanceRows.push({ label: `FAR (non-residential): ${rec.far_non_residential.max}`, value: '', pct: 1, color: '#7d9b76' })
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
      primary={{ eyebrow: 'At a glance', rows: glanceRows }}
      onClose={onClose}
    >
      {/* District-definition citation — the §-section that defines this district
          type (e.g. §209.2 for RM). Links straight to the current code section. */}
      {rec.classification && (
        <div className="pt-3 text-[11px] text-ink-faint leading-snug">
          District defined at{' '}
          <a
            href={rec.classification.url}
            target="_blank"
            rel="noopener noreferrer"
            className="uppercase tracking-wider hover:text-ink"
          >
            {rec.classification.section} ↗
          </a>
        </div>
      )}

      {/* Full source-backed controls, each with a verbatim-quote disclosure.
          Rendered as a custom block (not primary.rows) because each row carries
          a <details> "what the code says". */}
      <div className="pt-5 border-t border-paper-edge">
        <div className="civic-eyebrow mb-3">Controls (source-verified)</div>
        <ul className="space-y-2.5">
          {rows.map((r) => (
            <RuleRow key={r.label} label={r.label} quote={r.quote} />
          ))}
        </ul>
      </div>

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
        {src.document && src.document_url && (
          <a
            href={src.document_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block hover:text-ink"
          >
            {src.document} ↗
          </a>
        )}
        {sectionLinks.map((c) => (
          <a
            key={c.section}
            href={c.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block hover:text-ink"
          >
            {c.section} ↗
          </a>
        ))}
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
