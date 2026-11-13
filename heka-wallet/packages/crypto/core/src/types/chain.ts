// Describes a chain and its assets as data, so screens and stores work for any chain an adapter supports.

/** CAIP-2 chain id. */
export type ChainId = `eip155:${number}` | `hedera:${'mainnet' | 'testnet'}`

/** CAIP-19 asset id, e.g. 'eip155:84532/erc20:0x036C…CF7e'. */
export type AssetId = string

export type AssetKind = 'native' | 'erc20' | 'hts'

export interface AssetDescriptor {
  id: AssetId
  symbol: string
  name: string
  decimals: number
  kind: AssetKind
  address?: string
  stable?: 'USD' | 'EUR'
}

export interface ChainExplorer {
  tx: (hash: string) => string
  address: (address: string) => string
}

export interface PaymasterConfig {
  kind: 'circle'
  version: '0.8'
  address: string
  bundlerUrl: string
}

export type HistorySource = 'rpc-logs' | 'mirror-node' | 'indexer'

export interface ChainFeatures {
  historySource: HistorySource
  autoCreateOnReceive: boolean
  mirrorNodeUrl?: string
  /** Absent on Hedera. */
  paymaster?: PaymasterConfig
  /** Block window for logs-based history (public RPCs cap the getLogs range). */
  historyWindowBlocks?: number
}

export type ChainKind = 'evm' | 'hedera-native'

export interface ChainDescriptor {
  id: ChainId
  name: string
  kind: ChainKind
  /** Mainnet twins ship disabled; the registry refuses them. */
  enabled: boolean
  /** 'evm' only; a 'hedera-native' entry uses the SDK network name and mirrorNodeUrl. */
  rpcUrl?: string
  explorer: ChainExplorer
  nativeAsset: AssetDescriptor
  assets: AssetDescriptor[]
  /** A send still pending after this long is marked 'unknown'. */
  pendingTimeoutMs: number
  features: ChainFeatures
}
