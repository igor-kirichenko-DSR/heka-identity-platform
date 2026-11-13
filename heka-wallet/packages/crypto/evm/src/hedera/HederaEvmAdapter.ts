import type { EvmAdapterOptions } from '../EvmAdapter'
import type {
  Account,
  AssetDescriptor,
  AssetId,
  HistoryPage,
  KeyProvider,
  StatusResult,
} from '@heka-wallet/crypto-core'
import type { Address } from 'viem'

import { encodeFunctionData, getAddress, isHash, TransactionReceiptNotFoundError } from 'viem'

import { EvmAdapter } from '../EvmAdapter'
import { EvmAdapterError } from '../errors'

import { HTS_FACADE_ABI, isAssociated } from './HtsFacade'
import { MirrorNodeClient } from './MirrorNodeClient'
import { entityIdOf } from './entityId'
import { hederaFeesPerGas, normaliseGasPrice } from './gasPrice'
import { mapMirrorTransactions } from './mirrorMapping'
import { tinybarToWeibar, weibarToTinybarCeil } from './units'

export interface HederaEvmAdapterOptions extends EvmAdapterOptions {
  /** Default: built from the entry's mirrorNodeUrl. Tests pass one with a stub fetch. */
  mirror?: MirrorNodeClient
}

const ZERO = BigInt(0)
/** A Mirror Node account with this many automatic associations accepts any token (HIP-904). */
const UNLIMITED_AUTO_ASSOCIATIONS = -1
const MIRROR_SUCCESS = 'SUCCESS'

/**
 * Hedera testnet and mainnet through the JSON-RPC relay. Writes and fee quotes go through the relay like any EVM
 * chain, with HBAR in tinybar (8 decimals) converted to the relay's weibar at the edge; reads and the confirmation of
 * every send come from the Mirror Node, the ledger's own record.
 */
export class HederaEvmAdapter extends EvmAdapter {
  private readonly mirror: MirrorNodeClient

  constructor(options: HederaEvmAdapterOptions) {
    super(options)
    const { mirrorNodeUrl } = options.config.descriptor.features
    if (!options.mirror && !mirrorNodeUrl) throw new EvmAdapterError(`Chain ${this.chain.id} has no Mirror Node URL`)
    this.mirror = options.mirror ?? new MirrorNodeClient({ baseUrl: mirrorNodeUrl as string })
  }

  /** Exact tinybar and token balances from the Mirror Node; an account the ledger does not know holds nothing. */
  async getBalances(account: Account, assets: AssetDescriptor[]): Promise<Record<AssetId, bigint>> {
    this.assertOwnAccount(account)
    assets.forEach((asset) => this.assertOwnAsset(asset))
    const ledgerAccount = await this.mirror.getAccount(getAddress(account.address))
    const balances: Record<AssetId, bigint> = {}
    assets.forEach((asset) => {
      if (asset.kind === 'native') {
        balances[asset.id] = ledgerAccount?.balance ?? ZERO
        return
      }
      const tokenId = entityIdOf(asset.address ?? '')
      balances[asset.id] = ledgerAccount?.tokens.find((token) => token.tokenId === tokenId)?.balance ?? ZERO
    })
    return balances
  }

  /** Relay receipt first, then the Mirror Node contract result; final only when both have the transaction. */
  async getStatus(txId: string): Promise<StatusResult> {
    if (!isHash(txId)) throw new EvmAdapterError(`Not a transaction hash: ${txId}`)
    const [receipt, ledgerResult] = await Promise.all([this.readReceipt(txId), this.mirror.getContractResult(txId)])
    const ledgerFailed = ledgerResult !== null && ledgerResult.result !== MIRROR_SUCCESS
    if (receipt === undefined) return ledgerFailed ? { status: 'failed' } : { status: 'pending' }
    const fee = this.receiptFee(receipt.gasUsed, receipt.effectiveGasPrice)
    if (receipt.status !== 'success' || ledgerFailed) return { status: 'failed', ...fee }
    if (ledgerResult === null) return { status: 'pending' }
    return { status: 'success', ...fee }
  }

  /** One page of the account's ledger transactions (HBAR and HTS), newest first; the cursor is the Mirror Node's link. */
  async getHistory(account: Account, cursor?: string): Promise<HistoryPage> {
    this.assertOwnAccount(account)
    const holder = getAddress(account.address)
    const ledgerAccount = await this.mirror.getAccount(holder)
    if (ledgerAccount === null) return { items: [] }
    const page = await this.mirror.getTransactions(ledgerAccount.account, cursor)
    const items = await mapMirrorTransactions(page.items, {
      chainId: this.chain.id,
      holderAddress: holder,
      holderId: ledgerAccount.account,
      nativeAsset: this.chain.nativeAsset,
      tokens: this.chain.assets.filter((asset) => asset.kind === 'hts'),
      resolveEthereumHash: async (transactionId) => (await this.mirror.getContractResult(transactionId))?.hash,
    })
    return page.next ? { items, next: page.next } : { items }
  }

  /** `pending` until the first inbound transfer creates the account on the ledger (HIP-583). */
  async activationState(account: Account): Promise<'active' | 'pending'> {
    this.assertOwnAccount(account)
    return (await this.mirror.getAccount(getAddress(account.address))) === null ? 'pending' : 'active'
  }

  /** The `0.0.x` id once the account exists. */
  async getAccountId(account: Account): Promise<string | undefined> {
    this.assertOwnAccount(account)
    return (await this.mirror.getAccount(getAddress(account.address)))?.account
  }

  /**
   * HBAR always. A token when the account takes any token automatically (auto-created accounts, HIP-904), has it
   * associated, or the token's facade says so (HIP-719). An account not on the ledger yet is auto-created on its first
   * transfer, so nothing needs enabling.
   */
  async isAssetEnabled(account: Account, asset: AssetDescriptor): Promise<boolean> {
    this.assertOwnAccount(account)
    this.assertOwnAsset(asset)
    if (asset.kind === 'native') return true
    const ledgerAccount = await this.mirror.getAccount(getAddress(account.address))
    if (ledgerAccount === null) return true
    if (ledgerAccount.maxAutomaticTokenAssociations === UNLIMITED_AUTO_ASSOCIATIONS) return true
    const tokenId = entityIdOf(asset.address ?? '')
    if (ledgerAccount.tokens.some((token) => token.tokenId === tokenId)) return true
    return isAssociated(this.client, this.hederaTokenAddress(asset), getAddress(account.address))
  }

  /** HIP-719 `associate()` on the token's address, signed by the holder; the fee is paid in HBAR. */
  async enableAsset(account: Account, asset: AssetDescriptor, keys: KeyProvider): Promise<{ txId: string }> {
    this.assertOwnAccount(account)
    this.assertOwnAsset(asset)
    if (asset.kind !== 'hts') throw new EvmAdapterError(`Asset ${asset.id} needs no association`)
    const call = {
      to: this.hederaTokenAddress(asset),
      value: ZERO,
      data: encodeFunctionData({ abi: HTS_FACADE_ABI, functionName: 'associate' }),
    }
    const txId = await this.sendPlanned(account, () => this.priceCall(account, call), keys)
    return { txId }
  }

  protected async readNativeBalance(address: Address): Promise<bigint> {
    return (await this.mirror.getAccount(address))?.balance ?? ZERO
  }

  /** From eth_gasPrice (always weibar), never from the block's baseFeePerGas, whose unit changes between calls. */
  protected async readFeesPerGas(): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }> {
    return hederaFeesPerGas(normaliseGasPrice(await this.client.getGasPrice()))
  }

  protected toCallValue(amount: bigint): bigint {
    return tinybarToWeibar(amount)
  }

  protected toNativeFee(fee: bigint): bigint {
    return weibarToTinybarCeil(fee)
  }

  /** Hedera tokens are allowed here (the base adapter refuses `hts`). */
  protected assertOwnAsset(asset: AssetDescriptor): void {
    const known = [this.chain.nativeAsset, ...this.chain.assets].some((candidate) => candidate.id === asset.id)
    if (!known) throw new EvmAdapterError(`Asset ${asset.id} is not on ${this.chain.id}`)
  }

  private hederaTokenAddress(asset: AssetDescriptor): Address {
    if (asset.address === undefined) throw new EvmAdapterError(`Token ${asset.id} has no EVM address`)
    return getAddress(asset.address)
  }

  /** The relay's receipt; undefined while it has none. */
  private async readReceipt(hash: `0x${string}`) {
    try {
      return await this.client.getTransactionReceipt({ hash })
    } catch (error) {
      if (error instanceof TransactionReceiptNotFoundError) return undefined
      throw error
    }
  }

  /** The fee the relay's receipt reports (weibar), in tinybar and rounded up; none when the receipt has no price. */
  private receiptFee(gasUsed: bigint, effectiveGasPrice: bigint): Pick<StatusResult, 'fee'> {
    if (effectiveGasPrice <= ZERO) return {}
    const amount = weibarToTinybarCeil(gasUsed * normaliseGasPrice(effectiveGasPrice))
    return { fee: { asset: this.chain.nativeAsset, amount } }
  }
}
