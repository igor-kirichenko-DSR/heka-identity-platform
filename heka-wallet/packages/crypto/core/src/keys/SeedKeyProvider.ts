import type { ChainDescriptor } from '../types'
import type { AddressBook } from './AddressBook'
import type { AuthProof, AuthProofIssuer, KeyProvider, KeyPurpose, SeedKind } from './KeyProvider'
import type { AddressRecord, SeedRecord, SeedStorage } from './SeedStorage'
import type { LocalAccount } from 'viem'

import { english, generateMnemonic } from 'viem/accounts'

import { AuthProofError, KeyLockedError, NoSeedError, UnsupportedKeyError } from '../errors'

import { AuthProofRegistry } from './AuthProofs'
import { emptyAddressRecord, SEED_RECORD_VERSION } from './SeedStorage'
import {
  assertAccountIndex,
  deriveLocalAccount,
  deriveLocalAccounts,
  parseMnemonic,
  parseRawKey,
  PUBLIC_TEST_MNEMONICS,
} from './derivation'

const ENTROPY_BITS: Record<12 | 24, 128 | 256> = { 12: 128, 24: 256 }

export interface SeedKeyProviderOptions {
  storage: SeedStorage
  /** Injected in tests for the proof age. */
  now?: () => number
}

interface PendingCall {
  reject: (error: Error) => void
}

const lockedError = (): KeyLockedError => new KeyLockedError('The wallet is locked')

/**
 * One seed per wallet. Keys exist only inside withAccount; nothing here keeps a key, an account or the phrase
 * between calls. Starts locked: the UI calls unlock() once the identity wallet is unlocked.
 */
export class SeedKeyProvider implements KeyProvider, AddressBook {
  private readonly storage: SeedStorage
  private readonly now: () => number
  private readonly proofs: AuthProofRegistry
  private readonly pending = new Set<PendingCall>()
  private locked = true
  private issuerCreated = false
  // Seed and address writes run one at a time: no lost address update, no two seeds racing.
  private writes: Promise<unknown> = Promise.resolve()

  constructor({ storage, now = Date.now }: SeedKeyProviderOptions) {
    this.storage = storage
    this.now = now
    this.proofs = new AuthProofRegistry(now)
  }

  get isLocked(): boolean {
    return this.locked
  }

  lock(): void {
    this.locked = true
    const calls = [...this.pending]
    this.pending.clear()
    calls.forEach((call) => call.reject(lockedError()))
  }

  unlock(): void {
    this.locked = false
  }

  /** Only once, for the confirmation flow; a second caller could mint proofs. */
  createAuthProofIssuer(): AuthProofIssuer {
    if (this.issuerCreated) throw new AuthProofError('The proof issuer was already handed out')
    this.issuerCreated = true
    return { issue: () => this.proofs.issue() }
  }

  hasSeed(): Promise<boolean> {
    return this.storage.hasSeed()
  }

  async seedKind(): Promise<SeedKind | undefined> {
    this.assertUnlocked()
    return (await this.storage.readSeed())?.kind
  }

  async createSeed(words: 12 | 24): Promise<string> {
    this.assertUnlocked()
    const entropy = ENTROPY_BITS[words]
    if (!entropy) throw new UnsupportedKeyError(`A new phrase has 12 or 24 words, not ${String(words)}`)
    let mnemonic = generateMnemonic(english, entropy)
    while (PUBLIC_TEST_MNEMONICS.includes(mnemonic)) mnemonic = generateMnemonic(english, entropy)
    await this.store('mnemonic', mnemonic)
    return mnemonic
  }

  async importSeed(mnemonic: string): Promise<void> {
    this.assertUnlocked()
    await this.store('mnemonic', parseMnemonic(mnemonic))
  }

  async importRawKey(privateKey: string): Promise<void> {
    this.assertUnlocked()
    await this.store('raw', parseRawKey(privateKey))
  }

  withAccount<T>(purpose: KeyPurpose, index: number, fn: (account: LocalAccount) => Promise<T>): Promise<T> {
    if (this.locked) return Promise.reject(lockedError())
    return new Promise<T>((resolve, reject) => {
      const call: PendingCall = { reject }
      this.pending.add(call)
      this.runWithAccount(call, purpose, index, fn)
        .then(resolve, reject)
        .finally(() => this.pending.delete(call))
    })
  }

  async revealMnemonic(auth: AuthProof): Promise<string> {
    this.assertUnlocked()
    this.proofs.consume(auth)
    const seed = await this.readSeedOrThrow()
    if (this.locked) throw lockedError()
    if (seed.kind !== 'mnemonic') throw new UnsupportedKeyError('A raw-key wallet has no recovery phrase')
    return seed.secret
  }

  async removeSeed(auth: AuthProof): Promise<void> {
    this.assertUnlocked()
    this.proofs.consume(auth)
    await this.serialize(() => this.storage.remove())
  }

  /** Reads the address record only, never the seed. In the app it fails while locked: the store is closed then. */
  async getAddress(chain: ChainDescriptor, index: number): Promise<string | undefined> {
    if (chain.kind !== 'evm') return undefined
    const addresses = await this.storage.readAddresses()
    return addresses?.payment[String(index)]
  }

  private async runWithAccount<T>(
    call: PendingCall,
    purpose: KeyPurpose,
    index: number,
    fn: (account: LocalAccount) => Promise<T>
  ): Promise<T> {
    assertAccountIndex(index)
    const seed = await this.readSeedOrThrow()
    const account = await deriveLocalAccount(seed, purpose, index)
    // lock() during the read has already rejected this call; do not hand the key out.
    if (!this.pending.has(call)) throw lockedError()
    // Skipped by the storage when the seed was removed or replaced meanwhile.
    await this.serialize(() => this.storage.addAddress(seed, purpose, index, account.address))
    if (!this.pending.has(call)) throw lockedError()
    return fn(account)
  }

  private serialize<T>(write: () => Promise<T>): Promise<T> {
    const result = this.writes.then(write)
    // The caller gets the error through result; the queue only waits for it to settle.
    this.writes = Promise.allSettled([result])
    return result
  }

  private async store(kind: SeedKind, secret: string): Promise<void> {
    const seed: SeedRecord = {
      kind,
      secret,
      version: SEED_RECORD_VERSION,
      createdAt: new Date(this.now()).toISOString(),
    }
    const addresses: AddressRecord = emptyAddressRecord()
    const [payment, binding] = await deriveLocalAccounts(
      seed,
      kind === 'mnemonic'
        ? [
            { purpose: 'payment', index: 0 },
            { purpose: 'binding', index: 0 },
          ]
        : [{ purpose: 'payment', index: 0 }]
    )
    addresses.payment['0'] = payment.address
    if (binding) addresses.binding['0'] = binding.address
    await this.serialize(() => this.storage.writeSeed(seed, addresses))
  }

  private async readSeedOrThrow(): Promise<SeedRecord> {
    const seed = await this.storage.readSeed()
    if (!seed) throw new NoSeedError('No seed is stored')
    return seed
  }

  private assertUnlocked(): void {
    if (this.locked) throw lockedError()
  }
}
