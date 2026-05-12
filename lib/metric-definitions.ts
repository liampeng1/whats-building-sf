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
  transitTierRapidBus:
    'Within ¼ mile of a Muni rapid-bus (R-suffix) line, but not also rail.',
  transitTierLocalBus:
    'Within ¼ mile of a frequent local Muni line, but not rapid-bus or rail.',
  transitTierPoor:
    'No frequent transit within ¼ mile.',
} as const

export type MetricKey = keyof typeof METRIC_DEFINITIONS

export function getMetricDefinition(key: MetricKey): string | null {
  return (METRIC_DEFINITIONS as Record<string, string>)[key] ?? null
}
