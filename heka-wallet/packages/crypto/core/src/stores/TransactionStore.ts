import type { AdapterRegistry } from '../adapter'
import type { KeyProvider } from '../keys'
import type { LocalLedger } from '../ledger'
import type { CoreLogger } from '../logger'

import { makeObservable, observable, runInAction } from 'mobx'

import { NotReadyError, PendingSendError } from '../errors'
import {
  type Account,
  accountKey,
  type FeeQuote,
  sameAddress,
  type StatusResult,
  type TransferRequest,
  type TxRecord,
  txKey,
} from '../types'

import { TX_STATUS_POLL_MS } from './constants'

export interface TransactionStoreOptions {
  statusPollIntervalMs?: number
}

export interface HistoryState {
  isLoading: boolean
  hasMore: boolean
  next?: string
  error?: unknown
}

const IDLE_HISTORY: HistoryState = { isLoading: false, hasMore: true }

const newestFirst = (a: TxRecord, b: TxRecord): number => b.createdAt - a.createdAt || a.txId.localeCompare(b.txId)

/**
 * Sends money and tracks it to the end: a send is pending for seconds to minutes, chain history misses it until
 * mined and the app may be killed meanwhile. Holds the wallet's own sends (from the ledger) merged with chain
 * history pages. A send is polled until it is final, or marked 'unknown' after the chain's pendingTimeoutMs. One
 * pending send per account and chain.
 */
export class TransactionStore {
  /** The wallet's own sends by txKey; mirrors the ledger. */
  readonly localRecords = new Map<string, TxRecord>()
  /** Chain history items per accountKey, in page order. */
  readonly chainHistory = new Map<string, TxRecord[]>()
  readonly historyState = new Map<string, HistoryState>()
  isInitialized = false
  /** Last ledger read or write failure; the in-memory state stays authoritative. */
  ledgerError: unknown = undefined

  private readonly statusPollIntervalMs: number
  /** accountKeys with a submit in flight; observable so hasPendingSend updates when a submit ends. */
  private readonly submitting = new Set<string>()
  private readonly statusTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private disposed = false

  constructor(
    private readonly registry: AdapterRegistry,
    private readonly ledger: LocalLedger,
    private readonly keys: KeyProvider,
    private readonly logger: CoreLogger,
    options: TransactionStoreOptions = {}
  ) {
    this.statusPollIntervalMs = options.statusPollIntervalMs ?? TX_STATUS_POLL_MS
    makeObservable<this, 'submitting'>(this, {
      submitting: observable.shallow,
      localRecords: observable.shallow,
      chainHistory: observable.shallow,
      historyState: observable.shallow,
      isInitialized: observable,
      ledgerError: observable.ref,
    })
  }

  /** Loads the ledger and resumes status polling for every pending send. */
  async init(): Promise<void> {
    let records: TxRecord[] = []
    try {
      records = await this.ledger.list()
    } catch (error) {
      this.recordLedgerError('Failed to read the ledger', error)
    }
    runInAction(() => {
      records.forEach((record) => this.localRecords.set(txKey(record.chainId, record.txId), record))
      this.isInitialized = true
    })
    for (const record of records) {
      if (record.status !== 'pending') continue
      if (!this.registry.has(record.chainId)) {
        this.logger.warn('Pending send on an unregistered chain is not polled', {
          chainId: record.chainId,
          txId: record.txId,
        })
        continue
      }
      this.scheduleStatus(txKey(record.chainId, record.txId), 0)
    }
  }

  hasPendingSend(account: Account): boolean {
    if (this.submitting.has(accountKey(account.chainId, account.address))) return true
    return [...this.localRecords.values()].some(
      (record) =>
        record.status === 'pending' &&
        record.chainId === account.chainId &&
        sameAddress(record.account, account.address)
    )
  }

  /** Signs and submits through the chain's adapter; the result is pending until the status poll settles it. */
  async submit(request: TransferRequest, quote?: FeeQuote): Promise<TxRecord> {
    const { from } = request
    // Before init() the ledger's pending sends are not loaded, so the one-pending rule cannot be checked.
    if (!this.isInitialized) throw new NotReadyError('Sends cannot be submitted before the ledger is loaded')
    if (this.hasPendingSend(from)) {
      throw new PendingSendError(`A send from ${from.address} on ${from.chainId} is still pending`)
    }
    const submittingKey = accountKey(from.chainId, from.address)
    runInAction(() => this.submitting.add(submittingKey))
    try {
      const result = await this.registry.get(from.chainId).transfer(request, this.keys)
      const record: TxRecord = {
        chainId: from.chainId,
        account: from.address,
        txId: result.txId,
        explorerHash: result.explorerHash ?? result.txId,
        direction: sameAddress(request.to, from.address) ? 'self' : 'out',
        asset: request.asset,
        amount: request.amount,
        counterparty: request.to,
        ...(quote ? { fee: { asset: quote.asset, amount: quote.amount } } : {}),
        status: 'pending',
        createdAt: Date.now(),
        source: 'local',
      }
      const key = txKey(record.chainId, record.txId)
      runInAction(() => this.localRecords.set(key, record))
      // The send is already on its way; a ledger failure must not make the caller think it was not sent.
      await this.persist(record)
      this.scheduleStatus(key, this.statusPollIntervalMs)
      return record
    } finally {
      runInAction(() => this.submitting.delete(submittingKey))
    }
  }

  /** Own sends and chain history for the account, de-duplicated, newest first. */
  historyOf(account: Account): TxRecord[] {
    const local = [...this.localRecords.values()].filter(
      (record) => record.chainId === account.chainId && sameAddress(record.account, account.address)
    )
    const known = new Set<string>()
    local.forEach((record) => {
      known.add(txKey(record.chainId, record.txId))
      known.add(txKey(record.chainId, record.explorerHash))
    })
    const fromChain = (this.chainHistory.get(accountKey(account.chainId, account.address)) ?? []).filter(
      (record) => !known.has(txKey(record.chainId, record.txId))
    )
    return [...local, ...fromChain].sort(newestFirst)
  }

  historyStateOf(account: Account): HistoryState {
    return this.historyState.get(accountKey(account.chainId, account.address)) ?? IDLE_HISTORY
  }

  /** First page; replaces what was loaded before. */
  loadHistory(account: Account): Promise<void> {
    return this.fetchHistoryPage(account, undefined)
  }

  loadMoreHistory(account: Account): Promise<void> {
    const state = this.historyStateOf(account)
    if (state.isLoading || !state.hasMore || state.next === undefined) return Promise.resolve()
    return this.fetchHistoryPage(account, state.next)
  }

  dispose(): void {
    this.disposed = true
    this.statusTimers.forEach((timer) => clearTimeout(timer))
    this.statusTimers.clear()
  }

  private async fetchHistoryPage(account: Account, cursor: string | undefined): Promise<void> {
    const key = accountKey(account.chainId, account.address)
    const previous = this.historyStateOf(account)
    runInAction(() => this.historyState.set(key, { ...previous, isLoading: true, error: undefined }))
    try {
      const page = await this.registry.get(account.chainId).getHistory(account, cursor)
      runInAction(() => {
        const items = cursor === undefined ? [] : [...(this.chainHistory.get(key) ?? [])]
        const seen = new Set(items.map((item) => txKey(item.chainId, item.txId)))
        for (const item of page.items) {
          const itemKey = txKey(item.chainId, item.txId)
          if (seen.has(itemKey)) continue
          seen.add(itemKey)
          items.push({ ...item, source: 'chain' })
        }
        this.chainHistory.set(key, items)
        this.historyState.set(key, { isLoading: false, hasMore: page.next !== undefined, next: page.next })
      })
      await this.settleFromHistory(page.items)
    } catch (error) {
      this.logger.warn('History page failed', { chainId: account.chainId, error: String(error) })
      runInAction(() => this.historyState.set(key, { ...previous, isLoading: false, error }))
    }
  }

  /**
   * A success or failure seen in chain history settles the matching own send (by txId or explorer hash). Also an
   * 'unknown' one: it timed out without an answer, and the chain now has one.
   */
  private async settleFromHistory(items: TxRecord[]): Promise<void> {
    for (const item of items) {
      if (item.status !== 'success' && item.status !== 'failed') continue
      const itemKey = txKey(item.chainId, item.txId)
      const local = [...this.localRecords.values()].find(
        (record) =>
          (record.status === 'pending' || record.status === 'unknown') &&
          (txKey(record.chainId, record.txId) === itemKey || txKey(record.chainId, record.explorerHash) === itemKey)
      )
      if (local) await this.settle(txKey(local.chainId, local.txId), { status: item.status })
    }
  }

  private scheduleStatus(key: string, delayMs: number): void {
    if (this.disposed) return
    const existing = this.statusTimers.get(key)
    if (existing !== undefined) clearTimeout(existing)
    this.statusTimers.set(
      key,
      setTimeout(() => void this.checkStatus(key), delayMs)
    )
  }

  private async checkStatus(key: string): Promise<void> {
    this.statusTimers.delete(key)
    const record = this.localRecords.get(key)
    if (this.disposed || !record || record.status !== 'pending' || !this.registry.has(record.chainId)) return
    const adapter = this.registry.get(record.chainId)

    let result: StatusResult = { status: 'pending' }
    try {
      result = await adapter.getStatus(record.txId)
    } catch (error) {
      this.logger.warn('Status check failed', { chainId: record.chainId, txId: record.txId, error: String(error) })
    }
    // A history page may have settled the send while the check was in flight.
    if (this.disposed || this.localRecords.get(key)?.status !== 'pending') return
    if (result.status === 'pending' && Date.now() - record.createdAt >= adapter.chain.pendingTimeoutMs) {
      result = { status: 'unknown' }
    }
    if (result.status === 'pending') {
      this.scheduleStatus(key, this.statusPollIntervalMs)
      return
    }
    await this.settle(key, result)
  }

  /** Applies a non-pending status to the current record; a success or failure is never changed again. */
  private async settle(key: string, result: StatusResult): Promise<void> {
    const current = this.localRecords.get(key)
    if (!current || current.status === 'success' || current.status === 'failed') return
    const timer = this.statusTimers.get(key)
    if (timer !== undefined) clearTimeout(timer)
    this.statusTimers.delete(key)
    const updated: TxRecord = {
      ...current,
      status: result.status,
      ...(result.explorerHash ? { explorerHash: result.explorerHash } : {}),
      ...(result.fee ? { fee: result.fee } : {}),
    }
    runInAction(() => this.localRecords.set(key, updated))
    await this.persist(updated)
  }

  private async persist(record: TxRecord): Promise<void> {
    try {
      await this.ledger.put(record)
    } catch (error) {
      this.recordLedgerError('Failed to write a send to the ledger', error, record)
    }
  }

  private recordLedgerError(message: string, error: unknown, record?: TxRecord): void {
    this.logger.error(message, { chainId: record?.chainId, txId: record?.txId, error: String(error) })
    runInAction(() => {
      this.ledgerError = error
    })
  }
}
