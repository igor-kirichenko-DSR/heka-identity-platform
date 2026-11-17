/** Fee maths for USDC-paid user operations. Rates are USDC base units per 1 ETH; everything is bigint. */

const WEI_PER_ETH = BigInt(10) ** BigInt(18)
const ONE = BigInt(1)

// Gas of a USDC transfer user operation, measured in Spike D: the first one carries the 7702 delegation.
const GAS_FIRST_OPERATION = BigInt(260_000)
const GAS_LATER_OPERATION = BigInt(200_000)

// The prepared maximum was 2.28 × the real cost in Spike D; "up to" shows 2.5 ×.
const MAX_NUMERATOR = BigInt(5)
const MAX_DENOMINATOR = BigInt(2)

// The permit must cover the paymaster's prefund even when the rate moves a little.
const PERMIT_NUMERATOR = BigInt(3)
const PERMIT_DENOMINATOR = BigInt(2)

const ceilDiv = (numerator: bigint, denominator: bigint): bigint => (numerator + denominator - ONE) / denominator

/** USDC base units for a cost in wei, rounded up. */
export const usdcForWei = (costWei: bigint, rate: bigint): bigint => ceilDiv(costWei * rate, WEI_PER_ETH)

export interface UsdcFee {
  /** The expected charge. */
  amount: bigint
  /** The most the holder can be charged ("up to"). */
  max: bigint
}

/** Quote from the modelled gas of one transfer: `amount` is the estimate, `max` the ceiling shown to the holder. */
export const estimateUsdcFee = (params: { delegated: boolean; maxFeePerGas: bigint; rate: bigint }): UsdcFee => {
  const gas = params.delegated ? GAS_LATER_OPERATION : GAS_FIRST_OPERATION
  const amount = usdcForWei(gas * params.maxFeePerGas, params.rate)
  return { amount, max: ceilDiv(amount * MAX_NUMERATOR, MAX_DENOMINATOR) }
}

/** The permit value for a prepared operation: its worst-case cost in USDC plus a margin. */
export const permitCeiling = (maxCostWei: bigint, rate: bigint): bigint =>
  ceilDiv(usdcForWei(maxCostWei, rate) * PERMIT_NUMERATOR, PERMIT_DENOMINATOR)

/** The rate a settled operation implies: the net USDC charged over the ETH cost it settled. */
export const rateFromReceipt = (chargedUsdc: bigint, actualGasCostWei: bigint): bigint | undefined =>
  chargedUsdc > BigInt(0) && actualGasCostWei > BigInt(0) ? (chargedUsdc * WEI_PER_ETH) / actualGasCostWei : undefined

/** The rate of the latest receipt, or the registry seed before any. Memory only. */
export class RateTracker {
  private rate: bigint

  constructor(seed: bigint) {
    this.rate = seed
  }

  current(): bigint {
    return this.rate
  }

  update(rate: bigint | undefined): void {
    if (rate !== undefined) this.rate = rate
  }
}
