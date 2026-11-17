import { estimateUsdcFee, permitCeiling, RateTracker, rateFromReceipt, usdcForWei } from '../../src/aa'

const ETH = BigInt(10) ** BigInt(18)
// 3 345.3 USDC per ETH, in USDC base units (Spike D)
const RATE = BigInt(3_345_300_000)

describe('usdcForWei', () => {
  it('converts a cost in wei at the rate, rounding up', () => {
    expect(usdcForWei(ETH, RATE)).toBe(RATE)
    expect(usdcForWei(BigInt(1), RATE)).toBe(BigInt(1))
  })
})

describe('estimateUsdcFee', () => {
  const maxFeePerGas = BigInt(6_000_000)

  it('quotes the later-operation gas and a ceiling above the estimate', () => {
    const fee = estimateUsdcFee({ delegated: true, maxFeePerGas, rate: RATE })
    expect(fee.amount).toBe(usdcForWei(BigInt(200_000) * maxFeePerGas, RATE))
    expect(fee.max).toBeGreaterThan(fee.amount)
  })

  it('quotes more for the first operation, which carries the delegation', () => {
    const first = estimateUsdcFee({ delegated: false, maxFeePerGas, rate: RATE })
    const later = estimateUsdcFee({ delegated: true, maxFeePerGas, rate: RATE })
    expect(first.amount).toBeGreaterThan(later.amount)
  })

  it('keeps the ceiling at 2.5 times the estimate', () => {
    const fee = estimateUsdcFee({ delegated: true, maxFeePerGas: ETH / BigInt(200_000), rate: RATE })
    expect(fee.amount).toBe(RATE)
    expect(fee.max).toBe((RATE * BigInt(5)) / BigInt(2))
  })
})

describe('permitCeiling', () => {
  it('covers the worst-case cost with a margin of 1.5', () => {
    expect(permitCeiling(ETH, RATE)).toBe((RATE * BigInt(3)) / BigInt(2))
  })
})

describe('rateFromReceipt', () => {
  it('derives the rate from the net charge and the ETH cost', () => {
    const cost = BigInt('1209461550000')
    const charged = BigInt(4046)
    expect(rateFromReceipt(charged, cost)).toBe((charged * ETH) / cost)
  })

  it('returns nothing for a zero charge or cost', () => {
    expect(rateFromReceipt(BigInt(0), BigInt(5))).toBeUndefined()
    expect(rateFromReceipt(BigInt(5), BigInt(0))).toBeUndefined()
  })
})

describe('RateTracker', () => {
  it('starts at the seed and follows the latest receipt', () => {
    const tracker = new RateTracker(RATE)
    expect(tracker.current()).toBe(RATE)
    tracker.update(BigInt(7))
    expect(tracker.current()).toBe(BigInt(7))
    tracker.update(undefined)
    expect(tracker.current()).toBe(BigInt(7))
  })
})
