export const METRIC_DEFINITIONS = {
  permitsInWindow:
    'Permits filed in the last 12 months matching the active filters.',
  homesAdded:
    'Net new dwelling units across all matching permits.',
  yoyChange:
    'Year-over-year change in permit count vs the same window one year prior.',
  daysToPermit:
    'Median days from filed → permitted, last 12 months, matching the active filters.',
  nearRail:
    '% of land within ¼ mi of BART, Muni Metro, Caltrain, or a Muni rapid-bus line.',
  zoningMix:
    'Distribution of zoning categories within this region by land area.',
  landShare:
    '% of SF land area in this category.',
  permitShare:
    '% of matching permits in this category.',
  transitTierRail:
    'Within ¼ mile of BART, Muni Metro, or Caltrain.',
  transitTierVeryFrequentBus:
    'Within ¼ mile of a stop with ≥ 12 combined bus trips/hr at peak (≤ ~5 min), but not rail.',
  transitTierFrequentBus:
    'Within ¼ mile of a stop with ≥ 6 combined bus trips/hr at peak (≤ ~10 min), but not rail.',
  transitTierBasicBus:
    'Within ¼ mile of a stop with ≥ 2 combined bus trips/hr at peak (≤ ~30 min), but not rail.',
  transitTierPoor:
    'No rail and fewer than 2 bus trips/hr at peak within ¼ mile.',
} as const

export type MetricKey = keyof typeof METRIC_DEFINITIONS

export function getMetricDefinition(key: MetricKey): string | null {
  return (METRIC_DEFINITIONS as Record<string, string>)[key] ?? null
}
