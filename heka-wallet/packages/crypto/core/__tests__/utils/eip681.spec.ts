import { buildEip681, parseEip681, parseEip681Number, UriError } from '../../src'

// Examples from EIP-681 (https://eips.ethereum.org/EIPS/eip-681#examples)
const EIP_NATIVE = 'ethereum:0xfb6916095ca1df60bb79Ce92ce3ea74c37c5d359?value=2.014e18'
const EIP_NATIVE_WITH_GAS =
  'ethereum:0xfb6916095ca1df60bb79Ce92ce3ea74c37c5d359?value=2.014e18&gas=10&gasLimit=21000&gasPrice=50'
const EIP_ERC20 =
  'ethereum:0x89205a3a3b2a69de6dbf7f01ed13b2108b2c43e7/transfer?address=0x8e23ee67d1332ad560396262c48ffbb01f93d052&uint256=1'

const USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
const RECIPIENT = '0x8e23ee67d1332ad560396262c48ffbb01f93d052'

describe('parseEip681', () => {
  it('reads the EIP native example in scientific notation', () => {
    expect(parseEip681(EIP_NATIVE)).toEqual({
      chainId: undefined,
      to: '0xfb6916095ca1df60bb79Ce92ce3ea74c37c5d359',
      amount: BigInt('2014000000000000000'),
    })
  })

  it('ignores the gas parameters of the EIP native example', () => {
    expect(parseEip681(EIP_NATIVE_WITH_GAS).amount).toBe(BigInt('2014000000000000000'))
  })

  it('reads the EIP ERC-20 transfer example', () => {
    expect(parseEip681(EIP_ERC20)).toEqual({
      chainId: undefined,
      to: RECIPIENT,
      token: '0x89205a3a3b2a69de6dbf7f01ed13b2108b2c43e7',
      amount: BigInt(1),
    })
  })

  it('reads the chain id and the pay- prefix', () => {
    const request = parseEip681(`ethereum:pay-${USDC}@84532/transfer?address=${RECIPIENT}&uint256=1500000`)
    expect(request).toEqual({ chainId: 'eip155:84532', to: RECIPIENT, token: USDC, amount: BigInt(1500000) })
  })

  it('leaves the amount out when the URI has none', () => {
    expect(parseEip681(`ethereum:${RECIPIENT}@1`)).toEqual({ chainId: 'eip155:1', to: RECIPIENT, amount: undefined })
  })

  it.each([
    ['another scheme', `bitcoin:${RECIPIENT}`],
    ['no target', 'ethereum:?value=1'],
    ['an unsupported function', `ethereum:${USDC}/approve?address=${RECIPIENT}&uint256=1`],
    ['a transfer without address', `ethereum:${USDC}/transfer?uint256=1`],
    ['a fractional amount', `ethereum:${RECIPIENT}?value=1.5`],
    ['a negative amount', `ethereum:${RECIPIENT}?value=-1`],
    ['a malformed parameter', `ethereum:${RECIPIENT}?value`],
    ['chain id zero', `ethereum:${RECIPIENT}@0`],
    ['malformed percent-encoding', `ethereum:${RECIPIENT}?value=%E0`],
  ])('rejects %s', (_case, uri) => {
    expect(() => parseEip681(uri)).toThrow(UriError)
  })
})

describe('parseEip681Number', () => {
  const MAX_UINT256 = (BigInt(1) << BigInt(256)) - BigInt(1)

  it.each([
    ['1', BigInt(1)],
    ['0.5e1', BigInt(5)],
    ['0.05e2', BigInt(5)],
    ['1.500e3', BigInt(1500)],
    ['0e999999999', BigInt(0)],
    ['1e077', BigInt(10) ** BigInt(77)],
    [MAX_UINT256.toString(), MAX_UINT256],
  ])('reads %s', (value, expected) => {
    expect(parseEip681Number(value)).toBe(expected)
  })

  it.each([
    ['a huge exponent from a hostile QR code', '1e999999999'],
    ['an exponent past uint256', '1e78'],
    ['a value past uint256', (MAX_UINT256 + BigInt(1)).toString()],
    ['a fraction below one unit', '0.005e2'],
  ])('rejects %s with UriError', (_case, value) => {
    expect(() => parseEip681Number(value)).toThrow(UriError)
  })
})

describe('buildEip681', () => {
  it('builds the native form and parses it back', () => {
    const uri = buildEip681({ chainId: 'eip155:84532', to: RECIPIENT, amount: BigInt('10000000000000000') })
    expect(uri).toBe(`ethereum:${RECIPIENT}@84532?value=10000000000000000`)
    expect(parseEip681(uri)).toEqual({ chainId: 'eip155:84532', to: RECIPIENT, amount: BigInt('10000000000000000') })
  })

  it('builds the token form and parses it back', () => {
    const uri = buildEip681({ chainId: 'eip155:84532', to: RECIPIENT, token: USDC, amount: BigInt(1500000) })
    expect(uri).toBe(`ethereum:${USDC}@84532/transfer?address=${RECIPIENT}&uint256=1500000`)
    expect(parseEip681(uri)).toEqual({ chainId: 'eip155:84532', to: RECIPIENT, token: USDC, amount: BigInt(1500000) })
  })

  it('refuses a non-EVM chain', () => {
    expect(() => buildEip681({ chainId: 'hedera:testnet', to: RECIPIENT })).toThrow(UriError)
  })

  it('refuses a negative amount', () => {
    expect(() => buildEip681({ chainId: 'eip155:1', to: RECIPIENT, amount: BigInt(-1) })).toThrow(UriError)
  })
})
