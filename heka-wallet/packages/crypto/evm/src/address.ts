import type { EvmChainConfig } from './types'
import type { AddressValidation } from '@heka-wallet/crypto-core'

import { sameAddress } from '@heka-wallet/crypto-core'
import { getAddress, isAddress, zeroAddress } from 'viem'

/** Warning code: the input had no EIP-55 checksum (single case), so a typo cannot be detected. */
export const ADDRESS_WARNING_NO_CHECKSUM = 'no-checksum'

const HEX_ADDRESS = /^0x[0-9a-fA-F]{40}$/
const HEX_LETTER = /[a-fA-F]/

const isSingleCase = (hex: string): boolean =>
  HEX_LETTER.test(hex) && (hex === hex.toLowerCase() || hex === hex.toUpperCase())

const isTokenContract = (address: string, config: EvmChainConfig): boolean =>
  config.descriptor.assets.some((asset) => asset.address !== undefined && sameAddress(asset.address, address))

export const validateEvmAddress = (input: string, config: EvmChainConfig): AddressValidation => {
  const value = input.trim()
  if (!HEX_ADDRESS.test(value)) return { ok: false }
  const singleCase = isSingleCase(value.slice(2))
  // Mixed case is an EIP-55 checksum and must match
  if (!singleCase && !isAddress(value, { strict: true })) return { ok: false }
  const normalized = getAddress(value)
  if (sameAddress(normalized, zeroAddress) || isTokenContract(normalized, config)) return { ok: false }
  return singleCase ? { ok: true, normalized, warning: ADDRESS_WARNING_NO_CHECKSUM } : { ok: true, normalized }
}
