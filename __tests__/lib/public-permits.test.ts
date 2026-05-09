import { csvEscape, rowsToCsv, type PublicRow } from '@/lib/public-permits'

function row(overrides: Partial<PublicRow> = {}): PublicRow {
  return {
    permit_number: '123',
    address: '1 Main St',
    permit_type: '1',
    permit_type_definition: 'new construction',
    status: 'issued',
    stage: 'permitted',
    description: null,
    filed_date: null,
    issued_date: null,
    completed_date: null,
    status_date: null,
    estimated_cost: null,
    existing_use: null,
    proposed_use: null,
    use_category: 'housing',
    existing_units: null,
    proposed_units: null,
    homes_delta: null,
    existing_stories: null,
    proposed_stories: null,
    block: null,
    lot: null,
    pipeline_status: null,
    pipeline_status_date: null,
    latitude: null,
    longitude: null,
    ...overrides,
  }
}

describe('csvEscape', () => {
  test('returns empty string for null/undefined', () => {
    expect(csvEscape(null)).toBe('')
    expect(csvEscape(undefined)).toBe('')
  })
  test('passes plain values through', () => {
    expect(csvEscape('hello')).toBe('hello')
    expect(csvEscape(42)).toBe('42')
  })
  test('quotes values containing commas', () => {
    expect(csvEscape('a,b')).toBe('"a,b"')
  })
  test('quotes values with newlines', () => {
    expect(csvEscape('line\n2')).toBe('"line\n2"')
  })
  test('escapes embedded double quotes by doubling', () => {
    expect(csvEscape('she said "hi"')).toBe('"she said ""hi"""')
  })
})

describe('rowsToCsv', () => {
  test('emits header line plus one row per record', () => {
    const csv = rowsToCsv([row({ permit_number: 'A' }), row({ permit_number: 'B' })])
    const lines = csv.trim().split('\n')
    expect(lines.length).toBe(3) // header + 2 data rows
    expect(lines[0]).toContain('permit_number')
    expect(lines[0]).toContain('latitude')
  })

  test('returns empty string when given no rows', () => {
    expect(rowsToCsv([])).toBe('')
  })

  test('escapes data fields safely', () => {
    const csv = rowsToCsv([row({ description: 'has, comma', address: '"quoted"' })])
    expect(csv).toContain('"has, comma"')
    expect(csv).toContain('"""quoted"""')
  })

  test('represents nulls as empty fields, not the literal string "null"', () => {
    const csv = rowsToCsv([row({ permit_number: 'X', address: '1 Main' })])
    // permit_number=X, address=1 Main, then a long run of empty fields
    expect(csv).not.toContain('null')
    // Header and data row should match column count
    const [header, data] = csv.trim().split('\n')
    expect(header.split(',').length).toBe(data.split(',').length)
  })
})
