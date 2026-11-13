import { EvmAdapterError } from '../../src'
import { hederaFeesPerGas, normaliseGasPrice } from '../../src/hedera/gasPrice'
import { tinybarToWeibar, weibarToTinybar, weibarToTinybarCeil } from '../../src/hedera/units'

const WEI = BigInt(10) ** BigInt(10)

describe('Hedera units', () => {
  it('scales 1 tinybar to 10^10 weibar and back', () => {
    expect(tinybarToWeibar(BigInt(1))).toBe(WEI)
    expect(weibarToTinybar(WEI)).toBe(BigInt(1))
  })

  it('keeps the largest HBAR supply exact (5e18 tinybar)', () => {
    const max = BigInt('5000000000000000000')
    expect(weibarToTinybar(tinybarToWeibar(max))).toBe(max)
  })

  it('rounds a relay balance down and a fee up', () => {
    const weibar = WEI + BigInt(1)
    expect(weibarToTinybar(weibar)).toBe(BigInt(1))
    expect(weibarToTinybarCeil(weibar)).toBe(BigInt(2))
    expect(weibarToTinybarCeil(WEI)).toBe(BigInt(1))
  })

  it('turns less than one tinybar into 0 (balance) and 1 (fee)', () => {
    expect(weibarToTinybar(WEI - BigInt(1))).toBe(BigInt(0))
    expect(weibarToTinybarCeil(BigInt(1))).toBe(BigInt(1))
    expect(weibarToTinybarCeil(BigInt(0))).toBe(BigInt(0))
  })

  it('refuses a negative amount', () => {
    expect(() => tinybarToWeibar(BigInt(-1))).toThrow(EvmAdapterError)
    expect(() => weibarToTinybar(BigInt(-1))).toThrow(EvmAdapterError)
  })
})

describe('Hedera gas price', () => {
  it('keeps a weibar price', () => {
    expect(normaliseGasPrice(BigInt('1300000000000'))).toBe(BigInt('1300000000000'))
  })

  it('scales a tinybar-looking price (Spike B: baseFeePerGas came back as 124)', () => {
    expect(normaliseGasPrice(BigInt(124))).toBe(BigInt('1240000000000'))
  })

  it('refuses zero and an absurd price', () => {
    expect(() => normaliseGasPrice(BigInt(0))).toThrow(EvmAdapterError)
    expect(() => normaliseGasPrice(BigInt(10) ** BigInt(18))).toThrow(EvmAdapterError)
  })

  it('adds a 20 % margin and no tip', () => {
    expect(hederaFeesPerGas(BigInt('1300000000000'))).toEqual({
      maxFeePerGas: BigInt('1560000000000'),
      maxPriorityFeePerGas: BigInt(0),
    })
  })
})
