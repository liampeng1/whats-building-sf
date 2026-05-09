import { padBlock } from '@/lib/mohcd'

describe('padBlock — block-number normalization', () => {
  test('zero-pads pure-numeric blocks to 4 digits', () => {
    expect(padBlock('337')).toBe('0337')
    expect(padBlock('1')).toBe('0001')
    expect(padBlock('42')).toBe('0042')
  })
  test('leaves already-padded values untouched', () => {
    expect(padBlock('0337')).toBe('0337')
    expect(padBlock('1234')).toBe('1234')
  })
  test('does not mutate alphanumeric blocks', () => {
    expect(padBlock('337A')).toBe('337A')
    expect(padBlock('A337')).toBe('A337')
  })
  test('preserves blocks already over 4 digits', () => {
    expect(padBlock('12345')).toBe('12345')
  })
})
