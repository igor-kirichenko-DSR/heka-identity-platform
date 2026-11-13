import type { AuthProof } from '../../src'

import {
  AccountStore,
  AdapterRegistry,
  InvalidSeedError,
  MemorySeedStorage,
  SeedKeyProvider,
  WalletStore,
} from '../../src'
import { BASE_SEPOLIA, makeChain } from '../helpers/chains'
import { FakeAdapter } from '../helpers/FakeAdapter'
import { makeLogger } from '../helpers/logger'
import { OTHER_MNEMONIC, OTHER_PAYMENT_0, OTHER_RAW_KEY } from '../helpers/seeds'

const setup = async (seed?: { kind: 'mnemonic' | 'raw'; secret: string }) => {
  const registry = new AdapterRegistry()
  registry.register(new FakeAdapter(makeChain(BASE_SEPOLIA)))
  const keys = new SeedKeyProvider({ storage: new MemorySeedStorage() })
  keys.unlock()
  if (seed?.kind === 'mnemonic') await keys.importSeed(seed.secret)
  if (seed?.kind === 'raw') await keys.importRawKey(seed.secret)
  const issuer = keys.createAuthProofIssuer()
  const logger = makeLogger()
  const accounts = new AccountStore(registry, keys, logger)
  const store = new WalletStore(keys, accounts, logger)
  return { store, keys, accounts, issuer, logger }
}

describe('WalletStore', () => {
  it('starts as loading', async () => {
    const { store } = await setup()

    expect(store.status).toBe('loading')
  })

  it.each([
    [undefined, 'none'],
    [{ kind: 'mnemonic' as const, secret: OTHER_MNEMONIC }, 'mnemonic'],
    [{ kind: 'raw' as const, secret: OTHER_RAW_KEY }, 'raw'],
  ])('loads the status of the stored seed (%o → %s)', async (seed, status) => {
    const { store } = await setup(seed)

    await store.load()

    expect(store.status).toBe(status)
  })

  it('stores a verified phrase and loads its account', async () => {
    const { store, accounts } = await setup()
    await store.load()

    await store.importPhrase(OTHER_MNEMONIC)

    expect(store.status).toBe('mnemonic')
    expect(accounts.currentAccount?.address.toLowerCase()).toBe(OTHER_PAYMENT_0.toLowerCase())
  })

  it('imports a raw key', async () => {
    const { store } = await setup()

    await store.importRawKey(OTHER_RAW_KEY)

    expect(store.status).toBe('raw')
  })

  it('keeps the status and rethrows when an import is invalid', async () => {
    const { store } = await setup()
    await store.load()

    await expect(store.importPhrase('not a phrase')).rejects.toThrow(InvalidSeedError)
    expect(store.status).toBe('none')
  })

  it('removes the seed and its accounts', async () => {
    const { store, accounts, issuer } = await setup({ kind: 'mnemonic', secret: OTHER_MNEMONIC })
    await store.load()

    await store.remove(issuer.issue())

    expect(store.status).toBe('none')
    expect(accounts.currentAccount).toBeUndefined()
  })

  it('keeps the seed when removal has no valid proof', async () => {
    const { store } = await setup({ kind: 'mnemonic', secret: OTHER_MNEMONIC })
    await store.load()

    await expect(store.remove({} as AuthProof)).rejects.toThrow()
    expect(store.status).toBe('mnemonic')
  })

  it('keeps a failed status read in error and logs it', async () => {
    const { store, keys, logger } = await setup()
    keys.lock()
    jest.spyOn(keys, 'hasSeed').mockRejectedValueOnce(new Error('store closed'))

    await store.load()

    expect(store.error).toEqual(new Error('store closed'))
    expect(logger.error).toHaveBeenCalledWith('Failed to read the wallet status', { error: 'Error: store closed' })
  })
})
