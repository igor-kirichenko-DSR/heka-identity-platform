import type { AdapterRegistry } from '../adapter'
import type { CoreLogger } from '../logger'
import type { AccountStore } from './AccountStore'

import { type IReactionDisposer, makeObservable, observable, reaction, runInAction } from 'mobx'

import { type Account, accountKey, type AssetId } from '../types'

import { BALANCE_POLL_INITIAL_MS, BALANCE_POLL_MAX_MS } from './constants'

export interface BalanceStoreOptions {
  initialIntervalMs?: number
  maxIntervalMs?: number
}

/**
 * Keeps balances fresh for the screens without hammering public RPCs: polls the current account's balances. The
 * interval doubles after every poll up to the cap and resets on foreground, refresh, unlock, a send or an
 * account change. Nothing is polled while locked or stopped.
 */
export class BalanceStore {
  readonly balances = new Map<string, Record<AssetId, bigint>>()
  isLoading = false
  error: unknown = undefined
  lastUpdatedAt: number | undefined = undefined

  private readonly initialIntervalMs: number
  private readonly maxIntervalMs: number
  private intervalMs: number
  private running = false
  private locked = false
  private timer: ReturnType<typeof setTimeout> | undefined
  /** Bumped on every reset, so a poll started before it does not schedule another one. */
  private generation = 0
  private readonly disposeAccountReaction: IReactionDisposer

  constructor(
    private readonly registry: AdapterRegistry,
    private readonly accountStore: AccountStore,
    private readonly logger: CoreLogger,
    options: BalanceStoreOptions = {}
  ) {
    this.initialIntervalMs = options.initialIntervalMs ?? BALANCE_POLL_INITIAL_MS
    this.maxIntervalMs = options.maxIntervalMs ?? BALANCE_POLL_MAX_MS
    this.intervalMs = this.initialIntervalMs
    makeObservable(this, {
      balances: observable.shallow,
      isLoading: observable,
      error: observable.ref,
      lastUpdatedAt: observable,
    })
    this.disposeAccountReaction = reaction(
      () => {
        const account = this.accountStore.currentAccount
        return account ? accountKey(account.chainId, account.address) : undefined
      },
      () => void this.restart()
    )
  }

  balancesOf(account: Account): Record<AssetId, bigint> | undefined {
    return this.balances.get(accountKey(account.chainId, account.address))
  }

  start(): void {
    this.running = true
    void this.restart()
  }

  stop(): void {
    this.running = false
    this.cancel()
  }

  setLocked(locked: boolean): void {
    this.locked = locked
    if (locked) this.cancel()
    else void this.restart()
  }

  onForeground(): void {
    void this.restart()
  }

  /** After a send: the balance will change soon. */
  notifySent(): void {
    void this.restart()
  }

  /** Pull-to-refresh: resolves when the immediate poll has finished. */
  refresh(): Promise<void> {
    return this.restart()
  }

  dispose(): void {
    this.stop()
    this.disposeAccountReaction()
  }

  private get active(): boolean {
    return this.running && !this.locked
  }

  private cancel(): void {
    if (this.timer !== undefined) clearTimeout(this.timer)
    this.timer = undefined
    this.generation += 1
    // A fetch still in flight belongs to the old generation and will not clear the flag itself.
    runInAction(() => {
      this.isLoading = false
    })
  }

  private restart(): Promise<void> {
    this.cancel()
    this.intervalMs = this.initialIntervalMs
    return this.active ? this.poll(this.generation) : Promise.resolve()
  }

  private async poll(generation: number): Promise<void> {
    await this.fetchBalances(generation)
    if (generation !== this.generation || !this.active) return
    const delay = this.intervalMs
    this.intervalMs = Math.min(delay * 2, this.maxIntervalMs)
    this.timer = setTimeout(() => void this.poll(generation), delay)
  }

  /**
   * Never throws: a failure is kept in `error` and logged, and polling goes on. Only the current generation writes
   * `isLoading` and `error`, so a fetch overtaken by a reset or an account change does not touch the screen state.
   */
  private async fetchBalances(generation: number): Promise<void> {
    const account = this.accountStore.currentAccount
    if (!account) return
    runInAction(() => {
      this.isLoading = true
    })
    try {
      const adapter = this.registry.get(account.chainId)
      const { nativeAsset, assets } = adapter.chain
      const result = await adapter.getBalances(account, [nativeAsset, ...assets])
      runInAction(() => {
        // Balances are stored per account, so a late result is still correct for its own account.
        this.balances.set(accountKey(account.chainId, account.address), result)
        if (generation !== this.generation) return
        this.error = undefined
        this.lastUpdatedAt = Date.now()
      })
    } catch (error) {
      this.logger.warn('Balance poll failed', { chainId: account.chainId, error: String(error) })
      runInAction(() => {
        if (generation === this.generation) this.error = error
      })
    } finally {
      runInAction(() => {
        if (generation === this.generation) this.isLoading = false
      })
    }
  }
}
