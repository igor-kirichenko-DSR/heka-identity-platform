import { EvmAdapterError } from './errors'

const GAS_MARGIN_NUMERATOR = BigInt(12)
const GAS_MARGIN_DENOMINATOR = BigInt(10)
const ONE = BigInt(1)

/** estimateGas × 1.2, rounded up. */
export const withGasMargin = (estimated: bigint): bigint =>
  (estimated * GAS_MARGIN_NUMERATOR + GAS_MARGIN_DENOMINATOR - ONE) / GAS_MARGIN_DENOMINATOR

export const assertGasCeiling = (gas: bigint, ceiling: bigint): void => {
  if (gas > ceiling) throw new EvmAdapterError(`Gas limit ${gas} is above this chain's ceiling ${ceiling}`)
}
