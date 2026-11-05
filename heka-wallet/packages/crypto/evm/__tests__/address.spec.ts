import { zeroAddress } from 'viem'

import { ADDRESS_WARNING_NO_CHECKSUM, baseSepolia, validateEvmAddress } from '../src'

import { RECIPIENT, USDC_ADDRESS } from './helpers/chain'

const validate = (input: string) => validateEvmAddress(input, baseSepolia)

describe('validateEvmAddress', () => {
  it('accepts a checksummed address without a warning', () => {
    expect(validate(RECIPIENT)).toEqual({ ok: true, normalized: RECIPIENT })
  })

  it('trims surrounding spaces', () => {
    expect(validate(`  ${RECIPIENT}\n`)).toEqual({ ok: true, normalized: RECIPIENT })
  })

  it('accepts an all-lowercase address with a no-checksum warning and returns it checksummed', () => {
    expect(validate(RECIPIENT.toLowerCase())).toEqual({
      ok: true,
      normalized: RECIPIENT,
      warning: ADDRESS_WARNING_NO_CHECKSUM,
    })
  })

  it('accepts an all-uppercase address with a no-checksum warning', () => {
    const upper = `0x${RECIPIENT.slice(2).toUpperCase()}`
    expect(validate(upper)).toEqual({ ok: true, normalized: RECIPIENT, warning: ADDRESS_WARNING_NO_CHECKSUM })
  })

  it('accepts an address without hex letters without a warning (nothing to checksum)', () => {
    const digits = '0x1234567890123456789012345678901234567890'
    expect(validate(digits)).toEqual({ ok: true, normalized: digits })
  })

  it('rejects a mixed-case address with a wrong checksum', () => {
    const typo = `${RECIPIENT.slice(0, -1)}c` // last char C → c breaks EIP-55
    expect(validate(typo)).toEqual({ ok: false })
  })

  it('rejects the zero address', () => {
    expect(validate(zeroAddress)).toEqual({ ok: false })
  })

  it('rejects a token contract of the chain, in any case', () => {
    expect(validate(USDC_ADDRESS)).toEqual({ ok: false })
    expect(validate(USDC_ADDRESS.toLowerCase())).toEqual({ ok: false })
  })

  it.each([
    '',
    '0x',
    'not an address',
    RECIPIENT.slice(2),
    `${RECIPIENT}00`,
    '0xZZ97970C51812dc3A010C7d01b50e0d17dc79C8',
  ])('rejects malformed input %p', (input) => {
    expect(validate(input)).toEqual({ ok: false })
  })
})
