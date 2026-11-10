import type { AuthProof, KeyProvider, SeedKind } from '../keys'
import type { CoreLogger } from '../logger'
import type { AccountStore } from './AccountStore'

import { action, makeObservable, observable, runInAction } from 'mobx'

/** 'loading' until the first load(); then whether the wallet has a seed and of which kind. */
export type WalletStatus = 'loading' | 'none' | SeedKind

/**
 * Whether the payment wallet exists, for the screens that choose between registration and the wallet. Every seed
 * change goes through here, so the status and the cached accounts follow it.
 */
export class WalletStore {
  status: WalletStatus = 'loading'
  error: unknown = undefined

  constructor(
    private readonly keys: KeyProvider,
    private readonly accounts: AccountStore,
    private readonly logger: CoreLogger
  ) {
    makeObservable<this, 'setStatus'>(this, {
      status: observable,
      error: observable.ref,
      setStatus: action,
    })
  }

  /** Reads the seed status; needs the identity wallet unlocked (the store is closed otherwise). */
  async load(): Promise<void> {
    runInAction(() => {
      this.error = undefined
    })
    try {
      const status: WalletStatus = (await this.keys.hasSeed()) ? ((await this.keys.seedKind()) ?? 'none') : 'none'
      this.setStatus(status)
      await this.accounts.load()
    } catch (error) {
      this.logger.error('Failed to read the wallet status', { error: String(error) })
      runInAction(() => {
        this.error = error
      })
    }
  }

  /** A verified new phrase or an imported one; validation errors reach the caller. */
  async importPhrase(phrase: string): Promise<void> {
    await this.keys.importSeed(phrase)
    await this.afterChange('mnemonic')
  }

  async importRawKey(privateKey: string): Promise<void> {
    await this.keys.importRawKey(privateKey)
    await this.afterChange('raw')
  }

  /** Deletes the seed and its cached addresses only, never the identity wallet. */
  async remove(auth: AuthProof): Promise<void> {
    await this.keys.removeSeed(auth)
    await this.afterChange('none')
  }

  private setStatus(status: WalletStatus): void {
    this.status = status
  }

  private async afterChange(status: WalletStatus): Promise<void> {
    this.setStatus(status)
    await this.accounts.load()
  }
}
