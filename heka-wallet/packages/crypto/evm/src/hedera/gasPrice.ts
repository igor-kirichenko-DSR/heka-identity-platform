import { EvmAdapterError } from '../errors'

const TEN = BigInt(10)
/** Below this the figure cannot be a weibar price (130 tinybar = 1.3 × 10^12 weibar): it is tinybar (Spike B). */
const WEIBAR_FLOOR = TEN ** BigInt(9)
/** Above this (10^5 tinybar per gas) the relay answer is not credible. */
const WEIBAR_CEILING = TEN ** BigInt(15)
const TO_WEIBAR = TEN ** BigInt(10)
const MARGIN_NUMERATOR = BigInt(12)
const MARGIN_DENOMINATOR = BigInt(10)
const ZERO = BigInt(0)

/** The relay's gas price in weibar. A tinybar-looking figure is scaled; zero or an absurd figure is refused. */
export const normaliseGasPrice = (raw: bigint): bigint => {
  if (raw <= ZERO) throw new EvmAdapterError(`The relay returned a gas price of ${raw}`)
  const weibar = raw < WEIBAR_FLOOR ? raw * TO_WEIBAR : raw
  if (weibar > WEIBAR_CEILING) throw new EvmAdapterError(`The relay returned an implausible gas price: ${raw}`)
  return weibar
}

/** The relay needs no tip: maxFeePerGas = gas price × 1.2 (price drift), priority fee 0. */
export const hederaFeesPerGas = (gasPrice: bigint): { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint } => ({
  maxFeePerGas: (gasPrice * MARGIN_NUMERATOR) / MARGIN_DENOMINATOR,
  maxPriorityFeePerGas: ZERO,
})
