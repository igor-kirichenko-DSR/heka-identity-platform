import { UnitsError } from '../errors'

/** Upper bound for token decimals (ERC-20 stores decimals as uint8). */
export const MAX_DECIMALS = 255

/** Plain non-negative decimal: no sign, no exponent, no spaces. */
const DECIMAL_PATTERN = /^(\d*)(?:\.(\d*))?$/
const TRAILING_ZEROS = /0+$/

const assertDecimals = (decimals: number): void => {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > MAX_DECIMALS) {
    throw new UnitsError(`Invalid decimals: ${decimals}`)
  }
}

export const pow10 = (exponent: number): bigint => BigInt(10) ** BigInt(exponent)

/** '1.5' with 6 decimals → 1500000n. */
export const parseUnits = (value: string, decimals: number): bigint => {
  assertDecimals(decimals)
  const match = DECIMAL_PATTERN.exec(value)
  if (!match) throw new UnitsError(`Not a plain non-negative decimal: "${value}"`)
  const [, whole = '', fraction = ''] = match
  if (!whole && !fraction) throw new UnitsError(`Not a plain non-negative decimal: "${value}"`)
  if (fraction.length > decimals) {
    throw new UnitsError(`"${value}" has more than ${decimals} fraction digits`)
  }
  const fractionUnits = fraction ? BigInt(fraction.padEnd(decimals, '0')) : BigInt(0)
  return BigInt(whole || '0') * pow10(decimals) + fractionUnits
}

/** 1500000n with 6 decimals → '1.5'; trailing fraction zeros are dropped. */
export const formatUnits = (value: bigint, decimals: number): string => {
  assertDecimals(decimals)
  const negative = value < BigInt(0)
  const abs = negative ? -value : value
  const base = pow10(decimals)
  const whole = abs / base
  const fraction = (abs % base).toString().padStart(decimals, '0').replace(TRAILING_ZEROS, '')
  const sign = negative ? '-' : ''
  return fraction ? `${sign}${whole}.${fraction}` : `${sign}${whole}`
}
