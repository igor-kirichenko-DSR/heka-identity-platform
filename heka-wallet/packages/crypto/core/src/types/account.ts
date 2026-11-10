import type { ChainId } from './chain'

export interface Account {
  chainId: ChainId
  address: string
  index: number
}

const HEX_PREFIX = /^0x/i

/** EVM addresses compare case-insensitively (EIP-55 is only a checksum); other forms are kept as they are. */
export const normalizeAddress = (address: string): string =>
  HEX_PREFIX.test(address) ? address.toLowerCase() : address

export const sameAddress = (a: string, b: string): boolean => normalizeAddress(a) === normalizeAddress(b)

/** One key per account and chain. */
export const accountKey = (chainId: ChainId, address: string): string => `${chainId}|${normalizeAddress(address)}`
