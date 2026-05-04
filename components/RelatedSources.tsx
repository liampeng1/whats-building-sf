interface Props {
  address: string
  permitNumber?: string
  lat?: number
  lng?: number
}

interface SourceLink {
  label: string
  url: (q: string) => string
  note?: string
}

const NEWS_SOURCES: SourceLink[] = [
  { label: 'SF YIMBY', url: (q) => `https://sfyimby.com/?s=${q}`, note: 'YIMBY-aligned SF development blog' },
  { label: 'SocketSite', url: (q) => `https://socketsite.com/?s=${q}`, note: 'SF real estate / development blog' },
  { label: 'The Standard', url: (q) => `https://sfstandard.com/?s=${q}` },
  { label: 'Mission Local', url: (q) => `https://missionlocal.org/?s=${q}` },
  { label: 'SF Chronicle', url: (q) => `https://www.sfchronicle.com/search/?action=search&q=${q}` },
  { label: 'Google News', url: (q) => `https://news.google.com/search?q=${q}+San+Francisco` },
  { label: 'Wikipedia', url: (q) => `https://en.wikipedia.org/w/index.php?search=${q}` },
]

export function RelatedSources({ address, permitNumber, lat, lng }: Props) {
  const q = encodeURIComponent(address)
  const streetView =
    lat != null && lng != null
      ? `https://www.google.com/maps?layer=c&cbll=${lat},${lng}`
      : `https://www.google.com/maps/place/${q}`

  // SF gov sources. PIM works by address; DBI Permit Tracking System
  // has a known deep-link by permit number.
  const pim = `https://sfplanninggis.org/PIM?searchString=${q}`
  const dbiPts = permitNumber
    ? `https://dbiweb02.sfgov.org/dbipts/default.aspx?page=PermitDetails&PermitNumber=${encodeURIComponent(permitNumber)}`
    : null
  const acaSearch = `https://aca-prod.accela.com/CCSF/Cap/CapHome.aspx?module=Permits`
  const dbiSource = `https://data.sfgov.org/Housing-and-Buildings/Building-Permits/i98e-djp9`

  return (
    <div className="space-y-6">
      <div>
        <div className="civic-eyebrow mb-4">SF official records</div>
        <ul className="flex flex-wrap gap-2">
          {dbiPts && (
            <li>
              <a
                href={dbiPts}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-xs px-3 py-1.5 rounded border border-paper-edge bg-paper hover:bg-paper-deep text-ink"
                title="Department of Building Inspection Permit Tracking System — official permit history"
              >
                DBI Permit Tracking ↗
              </a>
            </li>
          )}
          <li>
            <a
              href={pim}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-xs px-3 py-1.5 rounded border border-paper-edge bg-paper hover:bg-paper-deep text-ink"
              title="SF Planning Information Map — parcel-level data with permit and planning history"
            >
              SF Planning Map (PIM) ↗
            </a>
          </li>
          <li>
            <a
              href={acaSearch}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-xs px-3 py-1.5 rounded border border-paper-edge bg-paper hover:bg-paper-deep text-ink"
              title="Accela Citizen Access — search permit applications"
            >
              Accela Permits ↗
            </a>
          </li>
          <li>
            <a
              href={dbiSource}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-xs px-3 py-1.5 rounded border border-paper-edge bg-paper hover:bg-paper-deep text-ink"
              title="DataSF Building Permits dataset (i98e-djp9)"
            >
              DataSF source ↗
            </a>
          </li>
        </ul>
      </div>

      <div>
        <div className="civic-eyebrow mb-4">Outside coverage</div>

        <div className="flex flex-wrap gap-2 mb-5">
          <a
            href={streetView}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-3 py-1.5 rounded border border-paper-edge bg-paper hover:bg-paper-deep text-ink"
          >
            ◉ Street View ↗
          </a>
        </div>

        <div className="civic-eyebrow mb-2">Search news for this address</div>
        <ul className="flex flex-wrap gap-2">
          {NEWS_SOURCES.map((s) => (
            <li key={s.label}>
              <a
                href={s.url(q)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-xs px-3 py-1.5 rounded border border-paper-edge bg-paper hover:bg-paper-deep text-ink"
                title={s.note}
              >
                {s.label} ↗
              </a>
            </li>
          ))}
        </ul>

        <p className="mt-3 text-xs text-ink-faint italic">
          SF-specific blogs (SocketSite, SF YIMBY, Mission Local) carry the most signal for major
          construction; mainstream papers cover only the largest projects.
        </p>
      </div>
    </div>
  )
}
