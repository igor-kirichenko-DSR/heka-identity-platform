import type { AssetDescriptor, ChainId } from './chain'

import { normalizeAddress } from './account'

export type TxStatus = 'pending' | 'success' | 'failed' | 'unknown'

export type TxDirection = 'in' | 'out' | 'self'

export type TxSource = 'local' | 'chain'

export interface TxFee {
  asset: AssetDescriptor
  amount: bigint
}

export interface TxRecord {
  chainId: ChainId
  /** The holder's address this record belongs to. */
  account: string
  txId: string
  /** Differs from txId for user operations. */
  explorerHash: string
  direction: TxDirection
  asset: AssetDescriptor
  amount: bigint
  counterparty: string
  fee?: TxFee
  status: TxStatus
  /** Epoch milliseconds. */
  createdAt: number
  source: TxSource
}

export const isFinalStatus = (status: TxStatus): boolean => status !== 'pending'

/** De-duplication and ledger key: chain id + transaction id (EVM hashes compare case-insensitively). */
export const txKey = (chainId: ChainId, txId: string): string => `${chainId}|${normalizeAddress(txId)}`
