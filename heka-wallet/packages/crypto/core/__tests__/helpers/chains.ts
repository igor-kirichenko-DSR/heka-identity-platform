import type { AssetDescriptor, ChainDescriptor, ChainId } from '../../src'

export const TEST_PENDING_TIMEOUT_MS = 60_000

const nativeEth = (chainId: ChainId): AssetDescriptor => ({
  id: `${chainId}/slip44:60`,
  symbol: 'ETH',
  name: 'Ether',
  decimals: 18,
  kind: 'native',
})

export const usdcOn = (chainId: ChainId): AssetDescriptor => ({
  id: `${chainId}/erc20:0x036CbD53842c5426634e7929541eC2318f3dCF7e`,
  symbol: 'USDC',
  name: 'USD Coin',
  decimals: 6,
  kind: 'erc20',
  address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  stable: 'USD',
})

export const makeChain = (id: ChainId, overrides: Partial<ChainDescriptor> = {}): ChainDescriptor => ({
  id,
  name: `Test ${id}`,
  kind: 'evm',
  enabled: true,
  rpcUrl: 'http://localhost:8545',
  explorer: {
    tx: (hash) => `https://explorer.test/tx/${hash}`,
    address: (address) => `https://explorer.test/address/${address}`,
  },
  nativeAsset: nativeEth(id),
  assets: [usdcOn(id)],
  pendingTimeoutMs: TEST_PENDING_TIMEOUT_MS,
  features: { historySource: 'rpc-logs', autoCreateOnReceive: false, historyWindowBlocks: 10_000 },
  ...overrides,
})

export const BASE_SEPOLIA: ChainId = 'eip155:84532'
export const HEDERA_TESTNET_EVM: ChainId = 'eip155:296'
