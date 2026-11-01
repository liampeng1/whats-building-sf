# What's Building SF

Every major new-construction permit filed in San Francisco in the last two years, on a map.

**Live at [whats-building-sf.vercel.app](https://whats-building-sf.vercel.app)**

A public, non-commercial view into SF development: what's been filed, what's been approved,
what's under construction, and what just got finished. Built for neighbors and curious
residents rather than for planners — the goal is that someone can open it, find their block,
and understand what's happening there in under a minute.

## What it does

- **Interactive map** of new-construction building permits, clustered and colored by stage
  (filed → approved → under construction → completed).
- **Three lenses** over the map, each with its own directory and statistics:
  - *Neighborhoods* — permit counts, net new homes, year-over-year change, median approval time
  - *Zoning* — the parcel's zoning district, height limits, and which state housing laws
    (SB-9, SB-35, AB-2011, density bonus, ADU) plausibly apply
  - *Transit* — how much of the city sits near frequent transit, and what's being built there
- **[Latest activity](https://whats-building-sf.vercel.app/activity)** — a ranked feed of what
  just changed city-wide, significance-weighted so large projects surface above small ones.
- **Per-permit and per-neighborhood pages**, each with its own social preview image.
- **Open data out** — an [Atom feed](https://whats-building-sf.vercel.app/feed.xml) and public
  [JSON](https://whats-building-sf.vercel.app/api/public/permits.json) /
  [CSV](https://whats-building-sf.vercel.app/api/public/permits.csv) endpoints.
- **Embeddable** neighborhood widgets at `/embed/neighborhood/[name]`.

## Data sources

All data is public. Nothing here is scraped from behind a login.

| Source | Used for |
| --- | --- |
| [DataSF](https://data.sfgov.org) — Building Permits, Parcels, Planning | Permits, parcel geometry, planning cases |
| [SF Planning](https://sfplanning.org) | Zoning districts and height limits |
| [511.org](https://511.org) | Transit stops and frequency tiers |
| [MOHCD](https://data.sfgov.org) | Below-market-rate unit data |

Permit data refreshes nightly via a Vercel cron job (`/api/cron/refresh-permits`, 07:00 UTC),
which rebuilds a snapshot cached in Redis. The large geographic datasets under `public/` are
pre-built artifacts — see [Build scripts](#build-scripts).

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Leaflet + react-leaflet ·
Upstash Redis · deployed on Vercel.

Basemap tiles come from [OpenStreetMap](https://www.openstreetmap.org/copyright). If you fork
this and expect real traffic, switch to a tile provider with an API key — OSM's public tile
servers are for low-volume use, and their [tile usage
policy](https://operations.osmfoundation.org/policies/tiles/) applies.

## Running locally

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>.

The app works with no configuration at all — every external service degrades gracefully. Without
Redis it fetches permits directly from DataSF on each request (slower, but correct); without a
DataSF token it uses the lower anonymous rate limit.

### Environment variables

Copy any you need into `.env.local`. **All of them are optional.**

| Variable | Purpose | Without it |
| --- | --- | --- |
| `UPSTASH_REDIS_REST_URL`<br>`UPSTASH_REDIS_REST_TOKEN` | Caches the permit snapshot and backs the rate limiter. `KV_REST_API_URL` / `KV_REST_API_TOKEN` work as aliases. | Falls back to fetching DataSF per request |
| `DATASF_APP_TOKEN` | Raises the DataSF API rate limit | Uses the anonymous limit |
| `CRON_SECRET` | Bearer token the nightly refresh endpoint requires | `/api/cron/refresh-permits` rejects all callers |
| `GITHUB_FEEDBACK_TOKEN` | Lets the suggestion box file GitHub issues | Suggestion box returns an error |
| `MAPBOX_TOKEN` | Static map imagery in social preview images | Falls back to a generated image |
| `FIVE_ELEVEN_API_KEY` | Only used by the transit build scripts | Those scripts skip transit sources |
| `NEXT_PUBLIC_SITE_URL` | Canonical URL for social previews | Inferred from Vercel, else localhost |

## Scripts

```bash
npm run dev            # development server
npm run build          # production build
npm start              # serve the production build
npm test               # jest unit tests
npm run lint           # eslint
```

### Build scripts

The files in `public/*.geojson` are generated, not hand-edited. Regenerate them with:

```bash
npm run build:zoning   # zoning districts + height limits
npm run cross-stats    # precomputed cross-lens statistics
```

Both read credentials from `.env.local` and write into `public/`.

## Tests

```bash
npm test
```

364 unit tests covering the pure logic — permit classification and styling, zoning and state-law
eligibility, activity-feed ranking, statistics aggregation, and the parcel-thumbnail projection.
Data fetching and map rendering are deliberately not unit-tested; the pure functions they call are.

## Project layout

```
app/           routes — pages, API endpoints, OG image generation
components/    React components (Map, lens directories, activity feed)
lib/           pure logic — permit/zoning/activity derivation, DataSF clients, caching
scripts/       build-time data generation
public/        generated GeoJSON + static assets
docs/          design specs and implementation plans
__tests__/     unit tests
```

The split that matters: `lib/` is pure and tested, `app/` and `components/` do I/O and rendering.
New logic belongs in `lib/` with a test.

## Contributing

Issues and pull requests are welcome. The suggestion box on the live site files issues here too.

If you're adding a feature, there's probably a design spec under `docs/superpowers/specs/`
describing the thinking behind the area you're touching.

## License

[MIT](LICENSE) © 2026 Liam Peng

Permit and planning data is public record from the City and County of San Francisco. Map data
© [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.
