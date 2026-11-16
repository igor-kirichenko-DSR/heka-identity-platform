import type { AuthProof, KeyProvider } from '../keys'
import type { SigningRequest } from '../requests'
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

export interface SignedRequest {
  address: string
  signature: string
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
  /** Signing requests (F07): chain and content checks, thrown as SigningRequestError; nothing is signed here. */
  checkSigningRequest?(request: SigningRequest, context: { requestUrl: string }): void
  /** The address the request would be signed with, for the holder to read before signing. */
  signingAddress?(request: SigningRequest): Promise<string>
  /** Signs after the checks, inside KeyProvider.withAuthorizedAccount; returns the signing address and signature. */
  signRequest?(
    request: SigningRequest,
    context: { requestUrl: string },
    keys: KeyProvider,
    auth: AuthProof
  ): Promise<SignedRequest>
  /** Hedera alias accounts. */
  activationState?(account: Account): Promise<'active' | 'pending'>
  /** Hedera: the `0.0.x` account id; undefined while the account is not on the ledger. */
  getAccountId?(account: Account): Promise<string | undefined>
  /** Hedera: HTS association. */
  isAssetEnabled?(account: Account, asset: AssetDescriptor): Promise<boolean>
  /** Hedera: associate the token; fee in HBAR. */
  enableAsset?(account: Account, asset: AssetDescriptor, keys: KeyProvider): Promise<{ txId: string }>
}
