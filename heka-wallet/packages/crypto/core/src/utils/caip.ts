// CAIP-2 chain ids and CAIP-10 account ids ('eip155:84532:0xab…'): the chain-neutral ids WalletConnect uses.
import type { ChainId } from '../types'

import { UriError } from '../errors'

const CHAIN_ID_PATTERN = /^(?:eip155:[1-9]\d*|hedera:(?:mainnet|testnet))$/
const EIP155_PREFIX = 'eip155:'
/** CAIP-10 account_address. */
const ACCOUNT_ADDRESS_PATTERN = /^[-.%a-zA-Z0-9]{1,128}$/
const CAIP10_PARTS = 3

export interface Caip10Account {
  chainId: ChainId
  address: string
}

/** True for the CAIP-2 ids this wallet supports. */
export const isChainId = (value: string): value is ChainId => CHAIN_ID_PATTERN.test(value)

export const eip155ChainId = (reference: number | bigint): ChainId => {
  const chainId = `${EIP155_PREFIX}${reference}`
  if (!isChainId(chainId)) throw new UriError(`Invalid EIP-155 chain id: ${reference}`)
  return chainId
}

/** The numeric EIP-155 reference, or undefined for a non-EVM chain. */
export const eip155Reference = (chainId: ChainId): number | undefined =>
  chainId.startsWith(EIP155_PREFIX) ? Number(chainId.slice(EIP155_PREFIX.length)) : undefined

export const buildCaip10 = (chainId: ChainId, address: string): string => {
  if (!isChainId(chainId)) throw new UriError(`Unsupported chain id: ${chainId}`)
  if (!ACCOUNT_ADDRESS_PATTERN.test(address)) throw new UriError(`Invalid account address: ${address}`)
  return `${chainId}:${address}`
}

export const parseCaip10 = (value: string): Caip10Account => {
  const parts = value.split(':')
  if (parts.length !== CAIP10_PARTS) throw new UriError(`Not a CAIP-10 account id: ${value}`)
  const [namespace, reference, address] = parts
  const chainId = `${namespace}:${reference}`
  if (!isChainId(chainId)) throw new UriError(`Unsupported chain id: ${chainId}`)
  if (!ACCOUNT_ADDRESS_PATTERN.test(address)) throw new UriError(`Invalid account address: ${address}`)
  return { chainId, address }
}
