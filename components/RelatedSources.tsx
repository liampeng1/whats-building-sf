interface Props {
  address: string
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

export function RelatedSources({ address, lat, lng }: Props) {
  const q = encodeURIComponent(address)
  const coordsQ = lat != null && lng != null ? `${lat},${lng}` : address
  const mapsEmbed = `https://www.google.com/maps?q=${encodeURIComponent(coordsQ)}&output=embed`
  const streetView =
    lat != null && lng != null
      ? `https://www.google.com/maps?layer=c&cbll=${lat},${lng}`
      : `https://www.google.com/maps/place/${q}`

  return (
    <section className="mt-10">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">Photos &amp; outside coverage</h2>

      <div className="rounded overflow-hidden border border-gray-200 mb-4">
        <iframe
          title={`Map of ${address}`}
          src={mapsEmbed}
          width="100%"
          height="260"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          style={{ border: 0 }}
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <a
          href={streetView}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50"
        >
          📷 Street View ↗
        </a>
      </div>

      <div className="text-xs font-semibold text-gray-600 mb-2">Search news for this address</div>
      <ul className="flex flex-wrap gap-2">
        {NEWS_SOURCES.map((s) => (
          <li key={s.label}>
            <a
              href={s.url(q)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50"
              title={s.note}
            >
              {s.label} ↗
            </a>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-gray-400">
        Links open a fresh search in each outlet. SF-specific blogs (SocketSite, Mission Local) tend
        to have the most signal for major construction; mainstream papers cover only the largest
        projects.
      </p>
    </section>
  )
}
