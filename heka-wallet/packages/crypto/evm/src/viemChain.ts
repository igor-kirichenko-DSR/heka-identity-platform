import type { Chain } from 'viem'

import { defineChain } from 'viem'

import { EvmAdapterError } from './errors'
import { type EvmChainConfig, evmChainId } from './types'

/** Built from our registry entry: importing from 'viem/chains' pulls every chain into the bundle (Spike A). */
export const toViemChain = (config: EvmChainConfig): Chain => {
  const { descriptor, multicall3 } = config
  if (!descriptor.rpcUrl) throw new EvmAdapterError(`Chain ${descriptor.id} has no RPC URL`)
  const { name, symbol, decimals } = descriptor.nativeAsset
  return defineChain({
    id: evmChainId(config),
    name: descriptor.name,
    nativeCurrency: { name, symbol, decimals },
    rpcUrls: { default: { http: [descriptor.rpcUrl] } },
    ...(multicall3 ? { contracts: { multicall3: { address: multicall3 } } } : {}),
  })
}
