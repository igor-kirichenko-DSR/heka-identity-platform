import { formatAmount, shortAddress } from '../../src/utils/format'
import { BASE_SEPOLIA, makeChain, usdcOn } from '../helpers/services'

const eth = makeChain(BASE_SEPOLIA).nativeAsset
const usdc = usdcOn(BASE_SEPOLIA)
const WEI_PER_ETH = BigInt('1000000000000000000')

describe('formatAmount', () => {
  it.each([
    [BigInt(0), usdc, undefined, '0 USDC'],
    [BigInt(1500000), usdc, undefined, '1.5 USDC'],
    [BigInt(1), eth, undefined, '0.000000000000000001 ETH'],
    [WEI_PER_ETH * BigInt(123456789) + BigInt(1), eth, undefined, '123456789.000000000000000001 ETH'],
  ])('shows %s exactly without float math', (amount, asset, digits, expected) => {
    expect(formatAmount(amount, asset, digits)).toBe(expected)
  })

  it('cuts the fraction for lists instead of rounding it up', () => {
    expect(formatAmount(BigInt('1999999999999999999'), eth, 6)).toBe('1.999999 ETH')
  })

  it('shows a tiny non-zero balance as below the smallest shown amount', () => {
    expect(formatAmount(BigInt(1), eth, 6)).toBe('< 0.000001 ETH')
  })

  it('keeps zero as zero when cut', () => {
    expect(formatAmount(BigInt(0), eth, 6)).toBe('0 ETH')
  })
})

describe('shortAddress', () => {
  it('keeps both ends of a long address', () => {
    expect(shortAddress('0x1234567890abcdef1234567890abcdef12345678')).toBe('0x123456…345678')
  })

  it('leaves a short value as it is', () => {
    expect(shortAddress('0.0.1234')).toBe('0.0.1234')
  })
})
