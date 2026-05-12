# What's Building SF — Roadmap

Living plan for turning the site into more than a wrapper around DataSF.
Reflects what's already shipped (`✓`) and what remains; effort tags are
calibrated against the existing Next.js + Vercel + Upstash stack.

Effort: ⚡ ≤1 day · 🔧 1–3 days · 🏗️ 3+ days · 🚧 weeks
Impact: 🔥 = useful · 🔥🔥 = drives engagement · 🔥🔥🔥 = ships an HN/Reddit post

## Positioning

Three things that already differentiate us; we should *say* them louder:

1. **Daily refresh** vs. SF Planning's quarterly Pipeline PDF.
2. **Editorial design** that reads like a magazine, not a permit-tracker form.
3. **Open + free**: nightly DataSF snapshot + Pipeline join, no API key, no login.

The launch narrative leans on "the report the city doesn't publish."

## Pre-launch (ship in this slice)

| # | Task | Effort | Impact | Status |
|---|---|---|---|---|
| 1 | About-page pitch tightened — daily-vs-quarterly callout, "open data, no key" framing | ⚡ | 🔥🔥 | ✓ shipped |
| 2 | Public JSON + CSV API — `/api/public/permits.json`, `.csv`, daily-refreshed, no key | ⚡ | 🔥🔥🔥 | ✓ shipped |
| 3 | `/stats` page combining timing distributions + conversion rates + stalled list + RHNA progress | 🔧 | 🔥🔥🔥 | ✓ shipped |
| 4 | Per-stat permalinks (anchor IDs); per-stat OG images deferred to fast-follow | 🔧 | 🔥🔥🔥 | ✓ anchors shipped |
| 5 | Zoning overlay (DataSF `3i4a-hu95`) — toggleable map layer | 🔧 | 🔥🔥🔥 | ✓ shipped |
| 6 | MOHCD BMR inventory join (DataSF `aaxw-2cb8`) — affordability badges on permit pages | 🔧 | 🔥🔥🔥 | ✓ shipped |
| 7 | Transit-adjacent filter chip (≤½ mi BART/Muni rail) | ⚡ | 🔥🔥 | ✓ shipped |
| 8 | Embeddable neighborhood widget — `/embed/neighborhood/[name]` iframe | 🔧 | 🔥🔥🔥 | ✓ shipped |

**Test coverage:** 70 → 101 tests. New test files for `lib/stats.ts`, `lib/public-permits.ts`, `lib/transit.ts`, `lib/mohcd.ts`. All pre-launch items have unit tests.

## Week 1–2 after launch (capitalize)

- Time-lapse year-slider mode (5.1)
- Streetview / satellite embed per permit (5.2)
- Weekly auto-generated digest + RSS (4.1)
- Builder/developer leaderboards (2.6) + neighborhood velocity rankings (2.7)
- Twitter/X bot for notable filings (6.6)
- Per-neighborhood + per-category RSS feeds (6.4)

## Month 1–2 (YIMBY moat)

- Planning Commission calendar (scrape sfplanning.org/hearings) (3.1)
- Discretionary Review tracker (3.2) — *no other site has this in queryable form*
- Property Information Map (PIM) integration — planner names, hearing history (3.3)
- Project narrative pages for marquee projects (4.4)
- Census ACS demographic context per neighborhood (1.4)

## Month 2+ (with traffic in hand)

- Crowdsourced "I saw construction" geo-verified check-ins (8.1) — beats Pipeline's quarterly lag
- Email + push subscriptions (6.5) — needs lightweight DB (Neon Postgres)
- Peer-city comparisons (Oakland / SJ / Austin / Denver) (7.1, 7.2)
- Project-level threading across multi-permit site-permit + addenda (5.5)
- Eviction notices overlay (1.5) — sensitive, careful framing

## Backlog / nice-to-haves

- AI-generated per-permit summaries (4.2)
- Comparable projects sidebar (4.3)
- Architectural rendering scrape expansion (4.5)
- Search autocomplete by address / permit # (5.3)
- Historic preservation overlay (1.6)
- Tree canopy / EJScreen overlay (1.7)
- FEMA flood maps (1.8)
- Property assessor sales data (1.9)
- Methodology changelog page (9.2)
- Structured data / JSON-LD per permit (9.3)
- Accessibility audit (9.5)

## Infrastructure dependencies

- Pre-compute aggregations in nightly cron (10.1) — needed for `/stats`, leaderboards
- Public API rate limiting via Upstash (10.3) — needed once (2) ships
- Lightweight Postgres (Neon via Vercel) (10.2) — needed for subscriptions, crowdsourced features

## Launch targets

- **HN**: "I built a daily-refreshed map of every major construction permit in SF (sfplanning.org's only updates quarterly)"
- **r/yimby**: filtered URL highlighting AB-2011 / density-bonus / SB-35 projects
- **r/sanfrancisco**: deep-link with their neighborhood preselected, plus the `/stats` page
- **SF urbanist Twitter**: weekly digest + per-stat OG images

### Deferred follow-ups (post lens-directories)

- **Permit→zoning enrichment** — cron-side point-in-polygon pass that
  writes `zoning_category` onto every Permit in the daily snapshot.
  Unlocks `ZoningDirectory`'s Permits bar and "Top:" neighborhoods.
  Schema is already in place; no UI change required when this lands.
- **Permit→neighborhood enrichment** — similar PIP pass to populate
  `neighborhood` on each Permit, plus shape-adapter for the snake_case
  `filed_date` / camelCase `filedDate` mismatch. Until this lands,
  `/api/lens-stats` returns empty rollups for nhoods.
- **Z+ Zoning height-band slicing** — ingest DataSF height districts;
  add as a 4th option to the zoning drawer sub-tab.
- **Z++ State-law eligibility slicing** — per-parcel SB 9 / AB 2011 /
  SB 35 computation.
- **N3 Per-acre sort toggle** — third sort option on the neighborhoods
  directory.
- **Cross-stats build performance** — current runtime is ~30 min for a
  full rebuild. Bbox prefilter on per-zoning-category × nhood
  intersections could cut to ~3 min.
- **Glossary section on /about** — surface the new lens-directory
  metrics' definitions on the /about page, sourced from METRIC_DEFINITIONS.
