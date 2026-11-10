import type { AuthProof, KeyPurpose } from '../../src'
import type { LocalAccount } from 'viem'

import { mnemonicToSeedSync, validateMnemonic } from '@scure/bip39'
import { recoverMessageAddress } from 'viem'
import { english, HDKey, privateKeyToAccount } from 'viem/accounts'

import {
  AskarSeedStore,
  AUTH_PROOF_MAX_AGE_MS,
  AuthProofError,
  InvalidSeedError,
  KeyLockedError,
  MemorySeedStorage,
  NoSeedError,
  SeedExistsError,
  SeedKeyProvider,
  UnsupportedKeyError,
} from '../../src'
import { BASE_SEPOLIA, makeChain } from '../helpers/chains'
import { findKeyMaterial, mnemonicMaterial, rawKeyMaterial } from '../helpers/keyMaterial'
import { OTHER_MNEMONIC, OTHER_PAYMENT_0, OTHER_RAW_KEY } from '../helpers/seeds'
import { FakeSeedSession } from '../helpers/seedSession'

const EVM_CHAIN = makeChain(BASE_SEPOLIA)
const HEDERA_NATIVE = makeChain('hedera:testnet', { kind: 'hedera-native' })

const makeProvider = (options: { locked?: boolean } = {}) => {
  const clock = { now: Date.parse('2026-11-10T10:00:00.000Z') }
  const storage = new MemorySeedStorage()
  const provider = new SeedKeyProvider({ storage, now: () => clock.now })
  if (!options.locked) provider.unlock()
  return { provider, storage, clock }
}

/** lock() rejects the caller at once; this lets the provider's own chain run to its end before asserting on fn. */
const settleInternalWork = (): Promise<void> => new Promise((resolve) => setImmediate(resolve))

const address = (purpose: KeyPurpose, index: number, provider: SeedKeyProvider) =>
  provider.withAccount(purpose, index, async (account) => account.address)

describe('SeedKeyProvider', () => {
  describe('create and import', () => {
    it.each([12, 24] as const)('creates a valid %i-word phrase and stores it', async (words) => {
      const { provider } = makeProvider()

      const mnemonic = await provider.createSeed(words)

      expect(mnemonic.split(' ')).toHaveLength(words)
      expect(validateMnemonic(mnemonic, english)).toBe(true)
      await expect(provider.hasSeed()).resolves.toBe(true)
      await expect(provider.seedKind()).resolves.toBe('mnemonic')
    })

    it('records payment #0 and binding #0 addresses on create', async () => {
      const { provider, storage } = makeProvider()

      await provider.createSeed(12)

      const addresses = await storage.readAddresses()
      expect(addresses?.payment['0']).toBe(await address('payment', 0, provider))
      expect(addresses?.binding['0']).toBe(await address('binding', 0, provider))
    })

    it('imports a phrase and derives its known address', async () => {
      const { provider } = makeProvider()

      await provider.importSeed(OTHER_MNEMONIC)

      await expect(provider.getAddress(EVM_CHAIN, 0)).resolves.toBe(OTHER_PAYMENT_0)
      await expect(address('payment', 0, provider)).resolves.toBe(OTHER_PAYMENT_0)
    })

    it('refuses an invalid phrase and stores nothing', async () => {
      const { provider } = makeProvider()

      await expect(provider.importSeed(`${OTHER_MNEMONIC} abandon`)).rejects.toThrow(InvalidSeedError)
      await expect(provider.hasSeed()).resolves.toBe(false)
    })

    it('refuses a second seed and keeps the first', async () => {
      const { provider } = makeProvider()
      await provider.importSeed(OTHER_MNEMONIC)

      await expect(provider.createSeed(12)).rejects.toThrow(SeedExistsError)
      await expect(provider.importRawKey(OTHER_RAW_KEY)).rejects.toThrow(SeedExistsError)
      await expect(address('payment', 0, provider)).resolves.toBe(OTHER_PAYMENT_0)
    })

    it('refuses a word count other than 12 or 24 for a new phrase', async () => {
      const { provider } = makeProvider()

      await expect(provider.createSeed(18 as 12)).rejects.toThrow(UnsupportedKeyError)
    })
  })

  describe('raw-key wallet', () => {
    it('has payment #0 only and no binding address', async () => {
      const { provider, storage } = makeProvider()

      await provider.importRawKey(OTHER_RAW_KEY)

      await expect(provider.seedKind()).resolves.toBe('raw')
      await expect(address('payment', 0, provider)).resolves.toMatch(/^0x[0-9a-fA-F]{40}$/)
      await expect(address('binding', 0, provider)).rejects.toThrow(UnsupportedKeyError)
      await expect(address('payment', 1, provider)).rejects.toThrow(UnsupportedKeyError)
      expect((await storage.readAddresses())?.binding).toEqual({})
    })

    it('has no phrase to reveal', async () => {
      const { provider } = makeProvider()
      const issuer = provider.createAuthProofIssuer()
      await provider.importRawKey(OTHER_RAW_KEY)

      await expect(provider.revealMnemonic(issuer.issue())).rejects.toThrow(UnsupportedKeyError)
    })
  })

  describe('lock', () => {
    it('starts locked and refuses every key operation until unlock', async () => {
      const { provider } = makeProvider({ locked: true })
      const proof = provider.createAuthProofIssuer().issue()

      expect(provider.isLocked).toBe(true)
      await expect(provider.createSeed(12)).rejects.toThrow(KeyLockedError)
      await expect(provider.importSeed(OTHER_MNEMONIC)).rejects.toThrow(KeyLockedError)
      await expect(provider.importRawKey(OTHER_RAW_KEY)).rejects.toThrow(KeyLockedError)
      await expect(provider.seedKind()).rejects.toThrow(KeyLockedError)
      await expect(address('payment', 0, provider)).rejects.toThrow(KeyLockedError)
      await expect(provider.revealMnemonic(proof)).rejects.toThrow(KeyLockedError)
      await expect(provider.removeSeed(proof)).rejects.toThrow(KeyLockedError)

      provider.unlock()
      await provider.importSeed(OTHER_MNEMONIC)
      await expect(address('payment', 0, provider)).resolves.toBe(OTHER_PAYMENT_0)
    })

    it('rejects a withAccount call that is running when lock() is called', async () => {
      const { provider } = makeProvider()
      await provider.importSeed(OTHER_MNEMONIC)
      let entered!: () => void
      const inside = new Promise<void>((resolve) => (entered = resolve))
      let release!: () => void
      const pending = provider.withAccount('payment', 0, async () => {
        entered()
        await new Promise<void>((resolve) => (release = resolve))
        return 'signed'
      })
      await inside

      provider.lock()
      release()

      await expect(pending).rejects.toThrow(KeyLockedError)
      expect(provider.isLocked).toBe(true)
    })

    it('never opens the key when lock() comes while the seed is being read', async () => {
      const { provider, storage } = makeProvider()
      await provider.importSeed(OTHER_MNEMONIC)
      const readSeed = storage.readSeed.bind(storage)
      jest.spyOn(storage, 'readSeed').mockImplementationOnce(async () => {
        provider.lock()
        return readSeed()
      })
      const addAddress = jest.spyOn(storage, 'addAddress')
      const fn = jest.fn(async () => 'signed')

      await expect(provider.withAccount('payment', 0, fn)).rejects.toThrow(KeyLockedError)
      await settleInternalWork()
      expect(fn).not.toHaveBeenCalled()
      expect(addAddress).not.toHaveBeenCalled()
    })

    it('works again after unlock', async () => {
      const { provider } = makeProvider()
      await provider.importSeed(OTHER_MNEMONIC)

      provider.lock()
      provider.unlock()

      await expect(address('payment', 0, provider)).resolves.toBe(OTHER_PAYMENT_0)
    })
  })

  describe('withAccount', () => {
    it('keeps no key material after it returns', async () => {
      const { provider, storage } = makeProvider()
      await provider.importSeed(OTHER_MNEMONIC)
      let seen: LocalAccount | undefined

      await provider.withAccount('payment', 0, async (account) => {
        seen = account
      })

      // The injected storage holds the seed by design; everything else must not.
      expect(
        findKeyMaterial(provider, { material: mnemonicMaterial(OTHER_MNEMONIC), skip: [storage], objects: [seen] })
      ).toEqual([])
    })

    it('rethrows the error of fn and keeps no key material', async () => {
      const { provider, storage } = makeProvider()
      await provider.importRawKey(OTHER_RAW_KEY)
      const failure = new Error('rpc down')
      let seen: LocalAccount | undefined

      await expect(
        provider.withAccount('payment', 0, async (account) => {
          seen = account
          throw failure
        })
      ).rejects.toBe(failure)

      expect(
        findKeyMaterial(provider, { material: rawKeyMaterial(OTHER_RAW_KEY), skip: [storage], objects: [seen] })
      ).toEqual([])
    })

    it('has a leak check that finds key material in any form', () => {
      const seed = mnemonicToSeedSync(OTHER_MNEMONIC)
      const account = privateKeyToAccount(OTHER_RAW_KEY)
      const holder = {
        seedBytes: new Uint8Array(seed),
        root: HDKey.fromMasterSeed(seed),
        cache: new Map([['k', OTHER_RAW_KEY.toUpperCase()]]),
        accounts: new Set([account]),
      }

      expect(
        findKeyMaterial(holder, {
          material: { texts: [OTHER_RAW_KEY.slice(2)], bytes: [seed] },
          objects: [account],
        })
      ).toEqual([
        'root.seedBytes: secret bytes',
        'root.root: HDKey',
        'root.cache<map>: secret text',
        'root.accounts<set>: listed object',
      ])
    })

    it('refuses without a seed', async () => {
      const { provider } = makeProvider()

      await expect(address('payment', 0, provider)).rejects.toThrow(NoSeedError)
    })

    it('refuses an invalid index before reading the seed', async () => {
      const { provider, storage } = makeProvider()
      const readSeed = jest.spyOn(storage, 'readSeed')

      await expect(address('payment', -1, provider)).rejects.toThrow(UnsupportedKeyError)
      expect(readSeed).not.toHaveBeenCalled()
    })

    it('adds the address of a newly opened index to the record', async () => {
      const { provider, storage } = makeProvider()
      await provider.importSeed(OTHER_MNEMONIC)

      const second = await address('payment', 1, provider)

      expect((await storage.readAddresses())?.payment['1']).toBe(second)
    })

    it('does not rewrite the record for a cached index', async () => {
      const { provider, storage } = makeProvider()
      await provider.importSeed(OTHER_MNEMONIC)
      const addAddress = jest.spyOn(storage, 'addAddress')

      await address('payment', 0, provider)

      await expect(addAddress.mock.results[0].value).resolves.toBe(false)
    })

    it('writes addresses one at a time, so parallel new indexes are all kept', async () => {
      const { provider, storage } = makeProvider()
      await provider.importSeed(OTHER_MNEMONIC)
      const addAddress = storage.addAddress.bind(storage)
      let inFlight = 0
      let maxInFlight = 0
      jest.spyOn(storage, 'addAddress').mockImplementation(async (...args) => {
        inFlight += 1
        maxInFlight = Math.max(maxInFlight, inFlight)
        await Promise.resolve()
        const written = await addAddress(...args)
        inFlight -= 1
        return written
      })

      const [payment1, binding1, payment2] = await Promise.all([
        address('payment', 1, provider),
        address('binding', 1, provider),
        address('payment', 2, provider),
      ])

      expect(maxInFlight).toBe(1)
      const addresses = await storage.readAddresses()
      expect(addresses?.payment).toMatchObject({ '1': payment1, '2': payment2 })
      expect(addresses?.binding['1']).toBe(binding1)
    })

    it('does not record an address of a seed removed and replaced while the key was open', async () => {
      const { provider, storage } = makeProvider()
      await provider.importSeed(OTHER_MNEMONIC)
      const rawAddress = privateKeyToAccount(OTHER_RAW_KEY).address
      const readSeed = storage.readSeed.bind(storage)
      jest.spyOn(storage, 'readSeed').mockImplementationOnce(async () => {
        const old = await readSeed()
        await storage.remove()
        await storage.writeSeed(
          { kind: 'raw', secret: OTHER_RAW_KEY, version: 1, createdAt: '2026-11-10T10:00:00.000Z' },
          { payment: { '0': rawAddress }, binding: {} }
        )
        return old
      })

      await address('payment', 0, provider)

      await expect(storage.readAddresses()).resolves.toEqual({ payment: { '0': rawAddress }, binding: {} })
    })

    it('never hands the key out when lock() comes while the address is recorded', async () => {
      const { provider, storage } = makeProvider()
      await provider.importSeed(OTHER_MNEMONIC)
      const addAddress = storage.addAddress.bind(storage)
      jest.spyOn(storage, 'addAddress').mockImplementationOnce(async (...args) => {
        provider.lock()
        return addAddress(...args)
      })
      const fn = jest.fn(async () => 'signed')

      await expect(provider.withAccount('payment', 1, fn)).rejects.toThrow(KeyLockedError)
      await settleInternalWork()
      expect(fn).not.toHaveBeenCalled()
    })
  })

  describe('getAddress', () => {
    it('reads the cached address without opening the seed, also while locked', async () => {
      const { provider, storage } = makeProvider()
      await provider.importSeed(OTHER_MNEMONIC)
      const second = await address('payment', 1, provider)
      provider.lock()
      const readSeed = jest.spyOn(storage, 'readSeed')

      await expect(provider.getAddress(EVM_CHAIN, 1)).resolves.toBe(second)
      expect(readSeed).not.toHaveBeenCalled()
    })

    it('returns nothing for a non-EVM chain', async () => {
      const { provider } = makeProvider()
      await provider.importSeed(OTHER_MNEMONIC)

      await expect(provider.getAddress(HEDERA_NATIVE, 0)).resolves.toBeUndefined()
    })

    it('returns nothing without a seed or for an index never opened', async () => {
      const { provider } = makeProvider()

      await expect(provider.getAddress(EVM_CHAIN, 0)).resolves.toBeUndefined()
      await provider.importSeed(OTHER_MNEMONIC)
      await expect(provider.getAddress(EVM_CHAIN, 5)).resolves.toBeUndefined()
    })
  })

  describe('auth proofs', () => {
    const setup = async () => {
      const made = makeProvider()
      const issuer = made.provider.createAuthProofIssuer()
      await made.provider.importSeed(OTHER_MNEMONIC)
      return { ...made, issuer }
    }

    it('reveals the phrase with a fresh proof', async () => {
      const { provider, issuer } = await setup()

      await expect(provider.revealMnemonic(issuer.issue())).resolves.toBe(OTHER_MNEMONIC)
    })

    it('accepts a proof at exactly the maximum age', async () => {
      const { provider, issuer, clock } = await setup()
      const proof = issuer.issue()
      clock.now += AUTH_PROOF_MAX_AGE_MS

      await expect(provider.revealMnemonic(proof)).resolves.toBe(OTHER_MNEMONIC)
    })

    it.each<[string, (made: Awaited<ReturnType<typeof setup>>) => AuthProof | undefined]>([
      ['a missing proof', () => undefined],
      ['an object that was never issued', () => ({}) as AuthProof],
      [
        'a proof from another provider',
        () => {
          const other = makeProvider().provider
          return other.createAuthProofIssuer().issue()
        },
      ],
      [
        'a proof older than the maximum age',
        ({ issuer, clock }) => {
          const proof = issuer.issue()
          clock.now += AUTH_PROOF_MAX_AGE_MS + 1
          return proof
        },
      ],
    ])('refuses to reveal with %s', async (_case, makeProof) => {
      const made = await setup()

      await expect(made.provider.revealMnemonic(makeProof(made) as AuthProof)).rejects.toThrow(AuthProofError)
    })

    it('does not return the phrase when lock() comes while the seed is being read', async () => {
      const { provider, issuer, storage } = await setup()
      const readSeed = storage.readSeed.bind(storage)
      jest.spyOn(storage, 'readSeed').mockImplementationOnce(async () => {
        provider.lock()
        return readSeed()
      })

      await expect(provider.revealMnemonic(issuer.issue())).rejects.toThrow(KeyLockedError)
    })

    it('accepts a proof only once', async () => {
      const { provider, issuer } = await setup()
      const proof = issuer.issue()
      await provider.revealMnemonic(proof)

      await expect(provider.revealMnemonic(proof)).rejects.toThrow(AuthProofError)
    })

    it('hands the issuer out only once', async () => {
      const { provider } = await setup()

      expect(() => provider.createAuthProofIssuer()).toThrow(AuthProofError)
    })

    it('removes the seed and the addresses with a fresh proof', async () => {
      const { provider, issuer, storage } = await setup()

      await provider.removeSeed(issuer.issue())

      await expect(provider.hasSeed()).resolves.toBe(false)
      await expect(storage.readAddresses()).resolves.toBeUndefined()
    })

    it('keeps the seed when the proof for removal is stale', async () => {
      const { provider, issuer, clock } = await setup()
      const proof = issuer.issue()
      clock.now += AUTH_PROOF_MAX_AGE_MS + 1

      await expect(provider.removeSeed(proof)).rejects.toThrow(AuthProofError)
      await expect(provider.hasSeed()).resolves.toBe(true)
      await expect(provider.getAddress(EVM_CHAIN, 0)).resolves.toBe(OTHER_PAYMENT_0)
    })

    it('refuses to reveal without a seed', async () => {
      const { provider } = makeProvider()
      const issuer = provider.createAuthProofIssuer()

      await expect(provider.revealMnemonic(issuer.issue())).rejects.toThrow(NoSeedError)
    })
  })

  describe('over AskarSeedStore', () => {
    it('signs with the same address after create, lock and unlock', async () => {
      const session = new FakeSeedSession()
      const provider = new SeedKeyProvider({ storage: new AskarSeedStore((callback) => callback(session)) })
      provider.unlock()
      await provider.importSeed(OTHER_MNEMONIC)

      provider.lock()
      provider.unlock()

      const signature = await provider.withAccount('payment', 0, (account) => account.signMessage({ message: 'heka' }))
      await expect(recoverMessageAddress({ message: 'heka', signature })).resolves.toBe(OTHER_PAYMENT_0)
      await expect(provider.getAddress(EVM_CHAIN, 0)).resolves.toBe(OTHER_PAYMENT_0)
      expect(session.rows.get('crypto/seed')?.value).toBe(OTHER_MNEMONIC)
    })
  })
})
