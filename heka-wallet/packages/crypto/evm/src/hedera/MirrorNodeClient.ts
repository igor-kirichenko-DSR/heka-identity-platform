import type {
  MirrorAccount,
  MirrorContractResult,
  MirrorTokenTransfer,
  MirrorTransaction,
  MirrorTransactionsPage,
  MirrorTransfer,
} from './mirrorTypes'

import { EvmAdapterError } from '../errors'

export interface MirrorNodeClientOptions {
  baseUrl: string
  fetchFn?: typeof fetch
  timeoutMs?: number
  /** Retries after the first attempt, on network errors, timeouts, 429 and 5xx. */
  retries?: number
  backoffMs?: number
  /** Injected so tests wait for no real time. */
  sleep?: (ms: number) => Promise<void>
}

const DEFAULT_TIMEOUT_MS = 10_000
const DEFAULT_RETRIES = 2
const DEFAULT_BACKOFF_MS = 500
const PAGE_LIMIT = 25
/** JSON numbers lose precision above 2^53; tinybar totals can reach 5 × 10^18, so long integers are quoted before parsing. */
const LONG_INTEGER_FIELD = /("(?:balance|amount|charged_tx_fee)"\s*:\s*)(-?\d{15,})/g

type Json = Record<string, unknown>

const str = (value: unknown, field: string): string => {
  if (typeof value !== 'string') throw new EvmAdapterError(`Mirror Node: "${field}" is not a string`)
  return value
}

const amount = (value: unknown, field: string): bigint => {
  if (typeof value === 'number' || typeof value === 'string') return BigInt(value)
  throw new EvmAdapterError(`Mirror Node: "${field}" is not an amount`)
}

const list = (value: unknown): Json[] => (Array.isArray(value) ? (value as Json[]) : [])

/** '1793970441.116990104' → epoch milliseconds. */
const timestampMs = (value: unknown): number =>
  Number(BigInt(str(value, 'consensus_timestamp').split('.')[0]) * BigInt(1000))

const toTransfer = (raw: Json): MirrorTransfer => ({
  account: str(raw.account, 'account'),
  amount: amount(raw.amount, 'amount'),
})

const toTokenTransfer = (raw: Json): MirrorTokenTransfer => ({
  ...toTransfer(raw),
  tokenId: str(raw.token_id, 'token_id'),
})

const toTransaction = (raw: Json): MirrorTransaction => ({
  name: str(raw.name, 'name'),
  result: str(raw.result, 'result'),
  transactionId: str(raw.transaction_id, 'transaction_id'),
  nonce: Number(raw.nonce ?? 0),
  chargedFee: amount(raw.charged_tx_fee ?? 0, 'charged_tx_fee'),
  consensusMs: timestampMs(raw.consensus_timestamp),
  transfers: list(raw.transfers).map(toTransfer),
  tokenTransfers: list(raw.token_transfers).map(toTokenTransfer),
})

/** Read access to the Hedera Mirror Node REST API: timeouts, bounded backoff, exact bigint amounts. */
export class MirrorNodeClient {
  private readonly origin: string
  private readonly fetchFn: typeof fetch
  private readonly timeoutMs: number
  private readonly retries: number
  private readonly backoffMs: number
  private readonly sleep: (ms: number) => Promise<void>

  constructor(options: MirrorNodeClientOptions) {
    const url = new URL(options.baseUrl)
    if (url.protocol !== 'https:') throw new EvmAdapterError('The Mirror Node URL must be https')
    this.origin = url.origin
    this.fetchFn = options.fetchFn ?? fetch
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.retries = options.retries ?? DEFAULT_RETRIES
    this.backoffMs = options.backoffMs ?? DEFAULT_BACKOFF_MS
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
  }

  /** By EVM address or `0.0.x`; null when the ledger does not know the account (yet). */
  async getAccount(idOrAddress: string): Promise<MirrorAccount | null> {
    const body = await this.get(`/api/v1/accounts/${encodeURIComponent(idOrAddress)}?transactions=false`)
    if (body === null) return null
    const balance = (body.balance ?? {}) as Json
    return {
      account: str(body.account, 'account'),
      evmAddress: str(body.evm_address, 'evm_address'),
      hasKey: body.key !== null && body.key !== undefined,
      maxAutomaticTokenAssociations: Number(body.max_automatic_token_associations ?? 0),
      balance: amount(balance.balance ?? 0, 'balance'),
      tokens: list(balance.tokens).map((token) => ({
        tokenId: str(token.token_id, 'token_id'),
        balance: amount(token.balance, 'balance'),
      })),
    }
  }

  /** One page, newest first. Pass the previous page's `next` to continue. */
  async getTransactions(accountId: string, next?: string): Promise<MirrorTransactionsPage> {
    const path =
      next ?? `/api/v1/transactions?account.id=${encodeURIComponent(accountId)}&limit=${PAGE_LIMIT}&order=desc`
    const body = await this.get(this.sameOriginPath(path))
    if (body === null) return { items: [] }
    const links = (body.links ?? {}) as Json
    const nextLink = typeof links.next === 'string' ? links.next : undefined
    return {
      items: list(body.transactions).map(toTransaction),
      ...(nextLink ? { next: nextLink } : {}),
    }
  }

  /** By Ethereum hash or by transaction id; null while the Mirror Node has not seen it. */
  async getContractResult(hashOrTransactionId: string): Promise<MirrorContractResult | null> {
    const body = await this.get(`/api/v1/contracts/results/${encodeURIComponent(hashOrTransactionId)}`)
    if (body === null) return null
    return {
      hash: str(body.hash, 'hash'),
      result: str(body.result, 'result'),
      to: typeof body.to === 'string' ? body.to : undefined,
    }
  }

  /** A paging link from a response is followed only on the same Mirror Node. */
  private sameOriginPath(path: string): string {
    const url = new URL(path, this.origin)
    if (url.origin !== this.origin) throw new EvmAdapterError('Refusing a Mirror Node link to another origin')
    return `${url.pathname}${url.search}`
  }

  /** GET and parse; null on 404. */
  private async get(path: string): Promise<Json | null> {
    let lastError: unknown
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      if (attempt > 0) await this.sleep(this.backoffMs * 2 ** (attempt - 1))
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), this.timeoutMs)
      try {
        const response = await this.fetchFn(`${this.origin}${path}`, { signal: controller.signal })
        if (response.status === 404) return null
        if (response.status === 429 || response.status >= 500) {
          lastError = new EvmAdapterError(`Mirror Node answered ${response.status}`)
          continue
        }
        if (!response.ok) throw new EvmAdapterError(`Mirror Node answered ${response.status}`)
        return JSON.parse((await response.text()).replace(LONG_INTEGER_FIELD, '$1"$2"')) as Json
      } catch (error) {
        if (error instanceof EvmAdapterError) throw error
        lastError = error
      } finally {
        clearTimeout(timer)
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new EvmAdapterError(`Mirror Node request failed: ${String(lastError)}`)
  }
}
