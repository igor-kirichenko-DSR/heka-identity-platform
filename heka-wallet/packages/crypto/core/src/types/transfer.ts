import type { Account } from './account'
import type { AssetDescriptor } from './chain'
import type { TxFee, TxStatus } from './tx'

/** 'usdc-paymaster' only where chain.features.paymaster exists. */
export type FeeMode = 'native' | 'usdc-paymaster'

export interface TransferRequest {
  from: Account
  to: string
  asset: AssetDescriptor
  amount: bigint
  memo?: string
  feeMode: FeeMode
  feeCap?: bigint
}

export interface FeeQuote {
  mode: FeeMode
  asset: AssetDescriptor
  amount: bigint
  /** The permit ceiling in 'usdc-paymaster' mode. */
  max?: bigint
  display: string
}

export interface TransferResult {
  txId: string
  /** Set when the explorer hash differs from txId and is known at submission. */
  explorerHash?: string
}

/** What a status check learned. On a final status an adapter may add what only then exists. */
export interface StatusResult {
  status: TxStatus
  /** User operations: the bundler transaction hash, known only after inclusion. */
  explorerHash?: string
  /** The fee actually charged, when it differs from the quote (paymaster). */
  fee?: TxFee
}
