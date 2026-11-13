import type { AdapterRegistry } from '../adapter'
import type { AddressBook } from '../keys'
import type { CoreLogger } from '../logger'
import type { Account, ChainId } from '../types'

import { action, computed, makeObservable, observable, runInAction } from 'mobx'

import { AccountError } from '../errors'

import { DEFAULT_ACCOUNT_INDEX } from './constants'

/**
 * Which chain and address the screens show. Addresses come from F03's cached record, so showing them never
 * opens the seed or needs the PIN.
 */
export class AccountStore {
  readonly accountIndex = DEFAULT_ACCOUNT_INDEX
  currentChainId: ChainId | undefined = undefined
  readonly addresses = new Map<ChainId, string>()
  /** Ledger account ids (Hedera `0.0.x`), known once the account exists on the ledger. */
  readonly accountIds = new Map<ChainId, string>()
  isLoading = false
  error: unknown = undefined

  constructor(
    private readonly registry: AdapterRegistry,
    private readonly addressBook: AddressBook,
    private readonly logger: CoreLogger
  ) {
    makeObservable(this, {
      currentChainId: observable,
      addresses: observable.shallow,
      accountIds: observable.shallow,
      isLoading: observable,
      error: observable.ref,
      currentAccount: computed,
      setChain: action,
      setAccountId: action,
    })
  }

  get currentAccount(): Account | undefined {
    return this.currentChainId ? this.accountFor(this.currentChainId) : undefined
  }

  accountFor(chainId: ChainId): Account | undefined {
    const address = this.addresses.get(chainId)
    return address ? { chainId, address, index: this.accountIndex } : undefined
  }

  setChain(chainId: ChainId): void {
    if (!this.registry.has(chainId)) throw new AccountError(`Chain ${chainId} is not registered`)
    this.currentChainId = chainId
  }

  setAccountId(chainId: ChainId, accountId: string | undefined): void {
    if (accountId) this.accountIds.set(chainId, accountId)
    else this.accountIds.delete(chainId)
  }

  /** Reads the address record for every registered chain; a chain without one has no account yet. */
  async load(): Promise<void> {
    runInAction(() => {
      this.isLoading = true
      this.error = undefined
    })
    try {
      const chains = this.registry.list().map((adapter) => adapter.chain)
      const found = new Map<ChainId, string>()
      for (const chain of chains) {
        const address = await this.addressBook.getAddress(chain, this.accountIndex)
        if (address) found.set(chain.id, address)
      }
      runInAction(() => {
        this.addresses.clear()
        this.accountIds.clear()
        found.forEach((address, chainId) => this.addresses.set(chainId, address))
        if (!this.currentChainId || !this.registry.has(this.currentChainId)) this.currentChainId = chains[0]?.id
      })
    } catch (error) {
      this.logger.error('Failed to load account addresses', { error: String(error) })
      runInAction(() => {
        this.error = error
      })
    } finally {
      runInAction(() => {
        this.isLoading = false
      })
    }
  }
}
