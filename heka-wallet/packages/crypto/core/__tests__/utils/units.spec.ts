import { formatUnits, parseUnits, UnitsError } from '../../src'

describe('parseUnits / formatUnits', () => {
  it.each([
    ['1.5', 6, BigInt('1500000')],
    ['0.000001', 6, BigInt(1)],
    ['123.45678901', 8, BigInt('12345678901')],
    ['1', 18, BigInt('1000000000000000000')],
    ['0.000000000000000001', 18, BigInt(1)],
    [
      '115792089237316195423570985008687907853269984665640564039457.584007913129639935',
      18,
      BigInt(2) ** BigInt(256) - BigInt(1),
    ],
  ])('round-trips %s with %i decimals', (text, decimals, units) => {
    expect(parseUnits(text, decimals)).toBe(units)
    expect(formatUnits(units, decimals)).toBe(text)
  })

  it('reads zero, a bare fraction and a trailing dot', () => {
    expect(parseUnits('0', 6)).toBe(BigInt(0))
    expect(parseUnits('.5', 6)).toBe(BigInt('500000'))
    expect(parseUnits('2.', 6)).toBe(BigInt('2000000'))
  })

  it('formats without trailing fraction zeros and without a dot for whole values', () => {
    expect(formatUnits(BigInt('1500000'), 6)).toBe('1.5')
    expect(formatUnits(BigInt('2000000'), 6)).toBe('2')
    expect(formatUnits(BigInt(0), 18)).toBe('0')
    expect(formatUnits(BigInt(42), 0)).toBe('42')
  })

  it('formats a negative value with a sign', () => {
    expect(formatUnits(BigInt('-1500000'), 6)).toBe('-1.5')
  })

  it.each([
    ['more fraction digits than decimals', '1.0000001', 6],
    ['a negative value', '-1', 6],
    ['a plus sign', '+1', 6],
    ['an exponent', '1e6', 6],
    ['an empty string', '', 6],
    ['a lone dot', '.', 6],
    ['spaces', ' 1', 6],
    ['a comma separator', '1,5', 6],
    ['a fraction with zero decimals', '1.5', 0],
  ])('rejects %s', (_case, text, decimals) => {
    expect(() => parseUnits(text, decimals)).toThrow(UnitsError)
  })

  it.each([-1, 1.5, 256, Number.NaN])('rejects decimals %p', (decimals) => {
    expect(() => parseUnits('1', decimals)).toThrow(UnitsError)
    expect(() => formatUnits(BigInt(1), decimals)).toThrow(UnitsError)
  })
})
