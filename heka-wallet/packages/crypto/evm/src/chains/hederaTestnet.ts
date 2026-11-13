import type { EvmChainConfig } from '../types'
import type { AssetDescriptor, ChainId } from '@heka-wallet/crypto-core'

const CHAIN_ID: ChainId = 'eip155:296'
const EXPLORER = 'https://hashscan.io/testnet'
// Circle USDC on Hedera testnet is the HTS token 0.0.429274; its EVM address is the long-zero form of the number
// (checked on HashScan and through the relay, Spike B)
const USDC_TOKEN_ID = '0.0.429274'
const USDC_ADDRESS = '0x0000000000000000000000000000000000068cda'

const hbar: AssetDescriptor = {
  id: `${CHAIN_ID}/slip44:3030`,
  symbol: 'HBAR',
  name: 'HBAR',
  // Tinybar: the unit users, the Mirror Node and the SDK use; the relay's 18-decimal weibar is converted at the edge
  decimals: 8,
  kind: 'native',
}

const usdc: AssetDescriptor = {
  id: `${CHAIN_ID}/hts:${USDC_TOKEN_ID}`,
  symbol: 'USDC',
  name: 'USD Coin',
  decimals: 6,
  kind: 'hts',
  address: USDC_ADDRESS,
  stable: 'USD',
}

/** Hashio is for development and testing only; a commercial relay is a `CRYPTO_RPC_URL_HEDERA_TESTNET` override. */
export const hederaTestnet: EvmChainConfig = {
  descriptor: {
    id: CHAIN_ID,
    name: 'Hedera Testnet',
    kind: 'evm',
    enabled: true,
    rpcUrl: 'https://testnet.hashio.io/api',
    explorer: {
      tx: (hash) => `${EXPLORER}/transaction/${hash}`,
      address: (address) => `${EXPLORER}/account/${address}`,
    },
    nativeAsset: hbar,
    assets: [usdc],
    // Relay receipts took 7-73 s in Spike B
    pendingTimeoutMs: 300_000,
    features: {
      historySource: 'mirror-node',
      autoCreateOnReceive: true,
      mirrorNodeUrl: 'https://testnet.mirrornode.hedera.com',
    },
  },
  // Measured: HBAR send 21 000, HTS transfer ~37 000, auto-create 608 000, associate() 726 000 gas; x 1.2 margin (Spike B)
  gasLimitCeiling: BigInt(1_200_000),
  // Unused: Hedera history comes from the Mirror Node
  logsMaxRange: 1,
}
