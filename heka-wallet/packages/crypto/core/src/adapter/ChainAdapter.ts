import type { KeyProvider } from '../keys'
import type {
  Account,
  AssetDescriptor,
  AssetId,
  ChainDescriptor,
  FeeQuote,
  StatusResult,
  TransferRequest,
  TransferResult,
  TxRecord,
} from '../types'

export interface AddressValidation {
  ok: boolean
  normalized?: string
  warning?: string
}

export interface HistoryPage {
  items: TxRecord[]
  next?: string
}

export interface ChainAdapter {
  readonly chain: ChainDescriptor
  deriveAccount(keys: KeyProvider, index: number): Promise<Account>
  validateAddress(input: string): AddressValidation
  getBalances(account: Account, assets: AssetDescriptor[]): Promise<Record<AssetId, bigint>>
  estimateFee(req: TransferRequest): Promise<FeeQuote>
  /** Signs, submits and returns right after submission. */
  transfer(req: TransferRequest, keys: KeyProvider): Promise<TransferResult>
  getStatus(txId: string): Promise<StatusResult>
  getHistory(account: Account, cursor?: string): Promise<HistoryPage>
  /** Hedera alias accounts. */
  activationState?(account: Account): Promise<'active' | 'pending'>
  /** Hedera: the `0.0.x` account id; undefined while the account is not on the ledger. */
  getAccountId?(account: Account): Promise<string | undefined>
  /** Hedera: HTS association. */
  isAssetEnabled?(account: Account, asset: AssetDescriptor): Promise<boolean>
  /** Hedera: associate the token; fee in HBAR. */
  enableAsset?(account: Account, asset: AssetDescriptor, keys: KeyProvider): Promise<{ txId: string }>
}
