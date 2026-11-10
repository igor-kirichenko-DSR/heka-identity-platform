import type { EvmChainConfig } from '../types'
import type { AssetDescriptor, ChainId } from '@heka-wallet/crypto-core'

import { MULTICALL3_ADDRESS, OP_GAS_PRICE_ORACLE } from './constants'

const CHAIN_ID: ChainId = 'eip155:84532'
// Circle "USDC contract addresses", checked 2026-11-05 (Spike A/D)
const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
const EXPLORER = 'https://sepolia.basescan.org'

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

/** Public RPC: getLogs is capped at 200 blocks (Spike A); a keyed RPC URL is an override in F06. */
export const baseSepolia: EvmChainConfig = {
  descriptor: {
    id: CHAIN_ID,
    name: 'Base Sepolia',
    kind: 'evm',
    enabled: true,
    rpcUrl: 'https://sepolia.base.org',
    explorer: {
      tx: (hash) => `${EXPLORER}/tx/${hash}`,
      address: (address) => `${EXPLORER}/address/${address}`,
    },
    nativeAsset: eth,
    assets: [usdc],
    // Receipts arrive in 1–2 s (Spike A)
    pendingTimeoutMs: 120_000,
    features: {
      historySource: 'rpc-logs',
      autoCreateOnReceive: false,
      historyWindowBlocks: 10_000,
    },
  },
  // ETH send 21 000, USDC send ~62 000 gas (Spike A)
  gasLimitCeiling: BigInt(150_000),
  logsMaxRange: 200,
  multicall3: MULTICALL3_ADDRESS,
  l1FeeOracle: OP_GAS_PRICE_ORACLE,
}
