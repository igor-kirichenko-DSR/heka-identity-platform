/** The parts of the Mirror Node REST responses the wallet reads. Amounts are bigint (parsed without float loss). */

export interface MirrorAccount {
  account: string
  evmAddress: string
  /** null = a hollow account: auto-created, no key on the ledger until it first pays. */
  hasKey: boolean
  maxAutomaticTokenAssociations: number
  /** Tinybar. */
  balance: bigint
  tokens: { tokenId: string; balance: bigint }[]
}

export interface MirrorTransfer {
  account: string
  amount: bigint
}

export interface MirrorTokenTransfer extends MirrorTransfer {
  tokenId: string
}

export interface MirrorTransaction {
  name: string
  result: string
  transactionId: string
  nonce: number
  /** Tinybar. */
  chargedFee: bigint
  /** Epoch milliseconds. */
  consensusMs: number
  transfers: MirrorTransfer[]
  tokenTransfers: MirrorTokenTransfer[]
}

export interface MirrorTransactionsPage {
  items: MirrorTransaction[]
  /** Path and query of the next page (same Mirror Node), absent on the last page. */
  next?: string
}

export interface MirrorContractResult {
  /** The Ethereum transaction hash. */
  hash: string
  result: string
  to: string | undefined
}
