import type { EvmChainConfig } from '../../types'
import type { AssetDescriptor, ChainId } from '@heka-wallet/crypto-core'

import { MULTICALL3_ADDRESS } from '../constants'

const CHAIN_ID: ChainId = 'eip155:8453'
// Circle "USDC contract addresses"
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const EXPLORER = 'https://basescan.org'

const eth: AssetDescriptor = {
  id: `${CHAIN_ID}/slip44:60`,
  symbol: 'ETH',
  name: 'Ether',
  decimals: 18,
  kind: 'native',
}

const usdc: AssetDescriptor = {
  id: `${CHAIN_ID}/erc20:${USDC_ADDRESS}`,
  symbol: 'USDC',
  name: 'USD Coin',
  decimals: 6,
  kind: 'erc20',
  address: USDC_ADDRESS,
  stable: 'USD',
}

/** Mainnet twin of baseSepolia: ships disabled, the registry refuses it. */
export const baseMainnet: EvmChainConfig = {
  descriptor: {
    id: CHAIN_ID,
    name: 'Base',
    kind: 'evm',
    enabled: false,
    rpcUrl: 'https://mainnet.base.org',
    explorer: {
      tx: (hash) => `${EXPLORER}/tx/${hash}`,
      address: (address) => `${EXPLORER}/address/${address}`,
    },
    nativeAsset: eth,
    assets: [usdc],
    pendingTimeoutMs: 120_000,
    features: {
      historySource: 'rpc-logs',
      autoCreateOnReceive: false,
      historyWindowBlocks: 10_000,
    },
  },
  gasLimitCeiling: BigInt(150_000),
  logsMaxRange: 200,
  multicall3: MULTICALL3_ADDRESS,
}
