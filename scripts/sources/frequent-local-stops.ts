import type { FrequentLocalStop } from '../../lib/transit-stations'

/**
 * SFMTA Frequent Transit Network — local Muni lines with ≥ 6 trips/hr in
 * the AM peak (per SFMTA's published FTN map). Stop coordinates are pulled
 * from the same 511.org regional GTFS feed we already consume for rail and
 * rapid-bus stops; the heavy lifting lives in `./muni-stops.ts`.
 *
 * To refresh: run `npm run cross-stats` after editing FREQUENT_LOCAL_LINES
 * in `lib/transit-stations.ts`.
 */
export async function fetchFrequentLocalStops(): Promise<FrequentLocalStop[]> {
  const { fetchMuni } = await import('./muni-stops')
  const muni = await fetchMuni()
  return muni.local
}
