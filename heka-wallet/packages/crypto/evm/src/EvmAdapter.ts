import type {
  Account,
  AddressBook,
  AddressValidation,
  AssetDescriptor,
  AssetId,
  ChainAdapter,
  ChainDescriptor,
  FeeMode,
  FeeQuote,
  FeeWarning,
  HistoryPage,
  KeyProvider,
  StatusResult,
  TransferRequest,
  TransferResult,
} from '@heka-wallet/crypto-core'
import type { Address, Chain, Hex, PublicClient, Transport } from 'viem'

import { formatUnits } from '@heka-wallet/crypto-core'
import {
  createPublicClient,
  encodeFunctionData,
  erc20Abi,
  getAddress,
  http,
  isHash,
  TransactionReceiptNotFoundError,
} from 'viem'

import { withEvmAccount } from './EvmAccount'
import { validateEvmAddress } from './address'
import { EvmAdapterError } from './errors'
import { assertGasCeiling, withGasMargin } from './fees'
import {
  decodeCursor,
  encodeCursor,
  firstCursor,
  scanTransfers,
  sortAndDedupe,
  toTxRecord,
  TRANSFER_EVENT,
  type TransferLog,
} from './history'
import { type EvmChainConfig, evmChainId } from './types'
import { toViemChain } from './viemChain'

export interface EvmAdapterOptions {
  config: EvmChainConfig
  /** F03's cached address record; the key is opened only on a miss. */
  addressBook: AddressBook
  /** Default: HTTP to the entry's rpcUrl. Tests pass a custom transport. */
  transport?: Transport
}

/** A transaction ready to sign: everything except nonce and signature. */
interface PlannedTransaction {
  to: Address
  value: bigint
  data?: Hex
  gas: bigint
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
  /** Upper bound: gas × maxFeePerGas. */
  fee: bigint
}

const ZERO = BigInt(0)

const tokenAddress = (asset: AssetDescriptor): Address => {
  if (asset.address === undefined) throw new EvmAdapterError(`Token ${asset.id} has no contract address`)
  return getAddress(asset.address)
}

export class EvmAdapter implements ChainAdapter {
  readonly chain: ChainDescriptor
  private readonly config: EvmChainConfig
  private readonly chainIdNumber: number
  private readonly addressBook: AddressBook
  private readonly client: PublicClient<Transport, Chain>

  /** Builds the viem client for this entry; throws on an entry without an RPC URL or a non-EVM id. */
  constructor({ config, addressBook, transport }: EvmAdapterOptions) {
    const viemChain = toViemChain(config)
    this.config = config
    this.chain = config.descriptor
    this.chainIdNumber = evmChainId(config)
    this.addressBook = addressBook
    this.client = createPublicClient({ chain: viemChain, transport: transport ?? http(config.descriptor.rpcUrl) })
  }

  /** The account at index: the cached address, or derived from the payment key on a cache miss. */
  async deriveAccount(keys: KeyProvider, index: number): Promise<Account> {
    const cached = await this.addressBook.getAddress(this.chain, index)
    const address = cached ?? (await keys.withAccount('payment', index, async (account) => account.address))
    return { chainId: this.chain.id, address: getAddress(address), index }
  }

  /** EIP-55 check of a recipient; rejects the zero address and token contracts of this chain. */
  validateAddress(input: string): AddressValidation {
    return validateEvmAddress(input, this.config)
  }

  /** Balances in the smallest unit per asset id; ERC-20 through Multicall3 when the entry has it. */
  async getBalances(account: Account, assets: AssetDescriptor[]): Promise<Record<AssetId, bigint>> {
    this.assertOwnAccount(account)
    assets.forEach((asset) => this.assertOwnAsset(asset))
    const holder = getAddress(account.address)
    const tokens = assets.filter((asset) => asset.kind === 'erc20')
    const [nativeBalance, tokenBalances] = await Promise.all([
      assets.some((asset) => asset.kind === 'native') ? this.client.getBalance({ address: holder }) : undefined,
      this.readTokenBalances(holder, tokens),
    ])
    const balances: Record<AssetId, bigint> = {}
    assets.forEach((asset) => {
      if (asset.kind === 'native' && nativeBalance !== undefined) balances[asset.id] = nativeBalance
    })
    tokens.forEach((asset, i) => {
      balances[asset.id] = tokenBalances[i]
    })
    return balances
  }

  /** Native-mode quote: (estimated gas × 1.2) × maxFeePerGas, with a warning when ETH cannot cover it. */
  async estimateFee(req: TransferRequest): Promise<FeeQuote> {
    this.assertNativeMode(req.feeMode)
    const [plan, nativeBalance] = await Promise.all([
      this.planTransaction(req),
      this.client.getBalance({ address: getAddress(req.from.address) }),
    ])
    const { nativeAsset } = this.chain
    const needed = plan.fee + (req.asset.kind === 'native' ? req.amount : ZERO)
    const warnings: FeeWarning[] = nativeBalance < needed ? ['insufficient-native-balance'] : []
    return {
      mode: 'native',
      asset: nativeAsset,
      amount: plan.fee,
      display: `${formatUnits(plan.fee, nativeAsset.decimals)} ${nativeAsset.symbol}`,
      ...(warnings.length > 0 ? { warnings } : {}),
    }
  }

  /** Checks the RPC chain, signs with the payment key and submits; returns before the receipt. */
  async transfer(req: TransferRequest, keys: KeyProvider): Promise<TransferResult> {
    this.assertNativeMode(req.feeMode)
    const rpcChainId = await this.client.getChainId()
    if (rpcChainId !== this.chainIdNumber) {
      throw new EvmAdapterError(`RPC serves chain ${rpcChainId}, expected ${this.chainIdNumber}`)
    }
    const sender = getAddress(req.from.address)
    const [plan, nonce] = await Promise.all([
      this.planTransaction(req),
      this.client.getTransactionCount({ address: sender, blockTag: 'pending' }),
    ])
    if (req.feeCap !== undefined && plan.fee > req.feeCap) {
      throw new EvmAdapterError(`Fee ${plan.fee} is above the cap ${req.feeCap}`)
    }
    const { to, value, data, gas, maxFeePerGas, maxPriorityFeePerGas } = plan
    const serializedTransaction = await withEvmAccount(keys, req.from.index, sender, this.chainIdNumber, (signer) =>
      signer.signTransaction({ to, value, data, nonce, gas, maxFeePerGas, maxPriorityFeePerGas })
    )
    const hash = await this.client.sendRawTransaction({ serializedTransaction })
    return { txId: hash }
  }

  /** Receipt → success / failed with the fee paid; no receipt yet → pending. */
  async getStatus(txId: string): Promise<StatusResult> {
    if (!isHash(txId)) throw new EvmAdapterError(`Not a transaction hash: ${txId}`)
    try {
      const receipt = await this.client.getTransactionReceipt({ hash: txId })
      const fee = { asset: this.chain.nativeAsset, amount: receipt.gasUsed * receipt.effectiveGasPrice }
      return { status: receipt.status === 'success' ? 'success' : 'failed', fee }
    } catch (error) {
      if (error instanceof TransactionReceiptNotFoundError) return { status: 'pending' }
      throw error
    }
  }

  /** One page of ERC-20 transfers from and to the holder, newest first, inside the history window. */
  async getHistory(account: Account, cursor?: string): Promise<HistoryPage> {
    this.assertOwnAccount(account)
    const tokens = new Map(
      this.chain.assets.filter((asset) => asset.kind === 'erc20').map((asset) => [tokenAddress(asset), asset])
    )
    if (tokens.size === 0) return { items: [] }
    const holder = getAddress(account.address)
    const start = cursor !== undefined ? decodeCursor(cursor) : await this.firstHistoryCursor()
    const scan = await scanTransfers(start, this.config.logsMaxRange, (fromBlock, toBlock) =>
      this.fetchTransferLogs(holder, [...tokens.keys()], fromBlock, toBlock)
    )
    const logs = sortAndDedupe(scan.logs)
    const timestamps = await this.blockTimestamps(logs)
    const items = logs.flatMap((log) => {
      const asset = tokens.get(log.token)
      const timestamp = timestamps.get(log.blockNumber)
      return asset && timestamp !== undefined ? [toTxRecord(log, this.chain.id, holder, asset, timestamp)] : []
    })
    return scan.next ? { items, next: encodeCursor(scan.next) } : { items }
  }

  /** Validates the request and prices it; the nonce and signature are added by transfer. */
  private async planTransaction(req: TransferRequest): Promise<PlannedTransaction> {
    this.assertOwnAccount(req.from)
    this.assertOwnAsset(req.asset)
    if (req.amount <= ZERO) throw new EvmAdapterError('Amount must be positive')
    const recipient = this.validateAddress(req.to)
    if (!recipient.ok || recipient.normalized === undefined) {
      throw new EvmAdapterError(`Invalid recipient: ${req.to}`)
    }
    const to = getAddress(recipient.normalized)
    const call =
      req.asset.kind === 'native'
        ? { to, value: req.amount }
        : {
            to: tokenAddress(req.asset),
            value: ZERO,
            data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [to, req.amount] }),
          }
    const [fees, estimated] = await Promise.all([
      this.client.estimateFeesPerGas(),
      this.client.estimateGas({ account: getAddress(req.from.address), ...call }),
    ])
    const gas = withGasMargin(estimated)
    assertGasCeiling(gas, this.config.gasLimitCeiling)
    return {
      ...call,
      gas,
      maxFeePerGas: fees.maxFeePerGas,
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
      fee: gas * fees.maxFeePerGas,
    }
  }

  /** balanceOf per token, in the order given. */
  private async readTokenBalances(holder: Address, tokens: AssetDescriptor[]): Promise<bigint[]> {
    if (tokens.length === 0) return []
    const contracts = tokens.map((asset) => ({
      address: tokenAddress(asset),
      abi: erc20Abi,
      functionName: 'balanceOf' as const,
      args: [holder] as const,
    }))
    if (this.config.multicall3) {
      const results: readonly bigint[] = await this.client.multicall({ contracts, allowFailure: false })
      return [...results]
    }
    return Promise.all(contracts.map((contract) => this.client.readContract(contract)))
  }

  /** From the current head back historyWindowBlocks. */
  private async firstHistoryCursor() {
    const head = await this.client.getBlockNumber()
    const window = this.chain.features.historyWindowBlocks ?? this.config.logsMaxRange
    return firstCursor(head, BigInt(window))
  }

  /** Transfer logs of one block range, sent and received queried separately (topics are AND-ed). */
  private async fetchTransferLogs(
    holder: Address,
    tokens: Address[],
    fromBlock: bigint,
    toBlock: bigint
  ): Promise<TransferLog[]> {
    const query = { address: tokens, event: TRANSFER_EVENT, fromBlock, toBlock }
    const [sent, received] = await Promise.all([
      this.client.getLogs({ ...query, args: { from: holder } }),
      this.client.getLogs({ ...query, args: { to: holder } }),
    ])
    const logs: TransferLog[] = []
    ;[...sent, ...received].forEach((log) => {
      const { from, to, value } = log.args
      // Mined-only ranges; a log without these fields is malformed and skipped
      if (from === undefined || to === undefined || value === undefined) return
      if (log.blockNumber === null || log.logIndex === null || log.transactionHash === null) return
      logs.push({
        token: getAddress(log.address),
        from,
        to,
        value,
        blockNumber: log.blockNumber,
        logIndex: log.logIndex,
        transactionHash: log.transactionHash,
      })
    })
    return logs
  }

  /** Block timestamps in seconds, one request per distinct block. */
  private async blockTimestamps(logs: TransferLog[]): Promise<Map<bigint, bigint>> {
    const blockNumbers = [...new Set(logs.map((log) => log.blockNumber))]
    const blocks = await Promise.all(blockNumbers.map((blockNumber) => this.client.getBlock({ blockNumber })))
    return new Map(blocks.map((block, i) => [blockNumbers[i], block.timestamp]))
  }

  /** Only 'native' until F08 adds 'usdc-paymaster'. */
  private assertNativeMode(feeMode: FeeMode): void {
    if (feeMode !== 'native') throw new EvmAdapterError(`Fee mode ${feeMode} is not supported on ${this.chain.id}`)
  }

  /** Refuses an account of another chain. */
  private assertOwnAccount(account: Account): void {
    if (account.chainId !== this.chain.id) {
      throw new EvmAdapterError(`Account of ${account.chainId} passed to the ${this.chain.id} adapter`)
    }
  }

  /** Refuses an asset not listed in this chain entry. */
  private assertOwnAsset(asset: AssetDescriptor): void {
    const known = [this.chain.nativeAsset, ...this.chain.assets].some((candidate) => candidate.id === asset.id)
    if (!known || asset.kind === 'hts') throw new EvmAdapterError(`Asset ${asset.id} is not on ${this.chain.id}`)
  }
}
