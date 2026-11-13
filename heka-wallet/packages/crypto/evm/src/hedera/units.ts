import { EvmAdapterError } from '../errors'

/** HBAR is described in tinybar (8 decimals), the unit users, Mirror Node and the native SDK use. */
export const HBAR_DECIMALS = 8

/** The relay works in 18-decimal weibar: 1 tinybar = 10^10 weibar. */
const WEIBAR_PER_TINYBAR = BigInt(10) ** BigInt(10)
const ONE = BigInt(1)
const ZERO = BigInt(0)

const assertNonNegative = (value: bigint): void => {
  if (value < ZERO) throw new EvmAdapterError(`Negative amount: ${value}`)
}

/** Applied to amounts going into a relay transaction. */
export const tinybarToWeibar = (tinybar: bigint): bigint => {
  assertNonNegative(tinybar)
  return tinybar * WEIBAR_PER_TINYBAR
}

/** Relay-reported values; rounds down, so a balance is never overstated. */
export const weibarToTinybar = (weibar: bigint): bigint => {
  assertNonNegative(weibar)
  return weibar / WEIBAR_PER_TINYBAR
}

/** Fees; rounds up, so a quote is never below the charge. */
export const weibarToTinybarCeil = (weibar: bigint): bigint => {
  assertNonNegative(weibar)
  return (weibar + WEIBAR_PER_TINYBAR - ONE) / WEIBAR_PER_TINYBAR
}
