import type { FeeQuote } from '@heka-wallet/crypto-core'

import { checkFunds, maxAmount } from '../../src/utils/sendChecks'
import { BASE_SEPOLIA, makeChain, usdcOn } from '../helpers/services'

const eth = makeChain(BASE_SEPOLIA).nativeAsset
const usdc = usdcOn(BASE_SEPOLIA)
const n = (value: number | string) => BigInt(value)

const nativeQuote = (amount: bigint): FeeQuote => ({ mode: 'native', asset: eth, amount, display: '' })
const paymasterQuote = (amount: bigint, max: bigint): FeeQuote => ({
  mode: 'usdc-paymaster',
  asset: usdc,
  amount,
  max,
  display: '',
})

describe('checkFunds', () => {
  it('accepts a native send when amount plus fee fit the balance exactly', () => {
    expect(checkFunds({ asset: eth, amount: n(90), quote: nativeQuote(n(10)), balances: { [eth.id]: n(100) } })).toBe(
      'ok'
    )
  })

  it('refuses a native send when the fee no longer fits', () => {
    expect(checkFunds({ asset: eth, amount: n(91), quote: nativeQuote(n(10)), balances: { [eth.id]: n(100) } })).toBe(
      'insufficient-fee'
    )
  })

  it('refuses an amount above the balance', () => {
    expect(checkFunds({ asset: usdc, amount: n(101), quote: nativeQuote(n(1)), balances: { [usdc.id]: n(100) } })).toBe(
      'insufficient-amount'
    )
  })

  it('checks a token send against the token balance and the fee against the native balance', () => {
    const balances = { [usdc.id]: n(100), [eth.id]: n(5) }

    expect(checkFunds({ asset: usdc, amount: n(100), quote: nativeQuote(n(5)), balances })).toBe('ok')
    expect(checkFunds({ asset: usdc, amount: n(100), quote: nativeQuote(n(6)), balances })).toBe('insufficient-fee')
  })

  it('reserves the permit ceiling, not the estimate, in paymaster mode', () => {
    const balances = { [usdc.id]: n(100) }

    expect(checkFunds({ asset: usdc, amount: n(95), quote: paymasterQuote(n(2), n(5)), balances })).toBe('ok')
    expect(checkFunds({ asset: usdc, amount: n(96), quote: paymasterQuote(n(2), n(5)), balances })).toBe(
      'insufficient-fee'
    )
  })

  it('works with 18-decimal amounts beyond the float range', () => {
    const balance = n('1000000000000000000000001')
    expect(
      checkFunds({ asset: eth, amount: balance - n(1), quote: nativeQuote(n(1)), balances: { [eth.id]: balance } })
    ).toBe('ok')
  })
})

describe('maxAmount', () => {
  it('leaves room for the fee when the fee is paid in the sent asset', () => {
    expect(maxAmount(eth, { [eth.id]: n(100) }, nativeQuote(n(7)))).toBe(n(93))
  })

  it('takes the whole token balance when the fee is paid in another asset', () => {
    expect(maxAmount(usdc, { [usdc.id]: n(100) }, nativeQuote(n(7)))).toBe(n(100))
  })

  it('never goes below zero', () => {
    expect(maxAmount(eth, { [eth.id]: n(3) }, nativeQuote(n(7)))).toBe(n(0))
  })
})
