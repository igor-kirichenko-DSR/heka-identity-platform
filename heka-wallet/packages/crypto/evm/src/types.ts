import type { ChainDescriptor } from '@heka-wallet/crypto-core'
import type { Address } from 'viem'

import { eip155Reference } from '@heka-wallet/crypto-core'

import { EvmAdapterError } from './errors'

/** A registry entry for an EVM chain: the chain-agnostic descriptor plus what only the EVM adapter needs. */
export interface EvmChainConfig {
  descriptor: ChainDescriptor
  /** A gas limit above this is refused, not clamped (a clamped transaction runs out of gas on-chain). */
  gasLimitCeiling: bigint
  /** Largest block range one eth_getLogs call may cover on this chain's RPC. */
  logsMaxRange: number
  /** Batches ERC-20 balance reads when set. */
  multicall3?: Address
}

/** The numeric EIP-155 chain id of an 'eip155:N' entry. */
export const evmChainId = (config: EvmChainConfig): number => {
  const reference = eip155Reference(config.descriptor.id)
  if (reference === undefined) throw new EvmAdapterError(`Not an EVM chain: ${config.descriptor.id}`)
  return reference
}
