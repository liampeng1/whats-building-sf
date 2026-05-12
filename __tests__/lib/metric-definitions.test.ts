import { METRIC_DEFINITIONS, getMetricDefinition, type MetricKey } from '@/lib/metric-definitions'

describe('METRIC_DEFINITIONS', () => {
  it('has a definition for every documented metric key', () => {
    const required: MetricKey[] = [
      'permitsInWindow', 'homesAdded', 'yoyChange',
      'daysToPermit', 'nearRail', 'zoningMix',
      'landShare', 'permitShare',
    ]
    for (const key of required) {
      expect(METRIC_DEFINITIONS[key]).toBeTruthy()
      expect(METRIC_DEFINITIONS[key].length).toBeGreaterThan(20)
    }
  })

  it('returns the definition text for a known key', () => {
    expect(getMetricDefinition('nearRail')).toContain('¼ mi')
  })

  it('returns null for an unknown key', () => {
    // @ts-expect-error testing runtime fallback
    expect(getMetricDefinition('bogus')).toBeNull()
  })
})
