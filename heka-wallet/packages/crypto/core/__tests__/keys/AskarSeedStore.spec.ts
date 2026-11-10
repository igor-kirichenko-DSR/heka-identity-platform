import type { AddressRecord, SeedRecord } from '../../src'

import { ADDRESSES_ENTRY, AskarSeedStore, KeyStorageError, SEED_CATEGORY, SEED_ENTRY, SeedExistsError } from '../../src'
import { OTHER_MNEMONIC, OTHER_PAYMENT_0 } from '../helpers/seeds'
import { FakeSeedSession } from '../helpers/seedSession'

const SEED: SeedRecord = { kind: 'mnemonic', secret: OTHER_MNEMONIC, version: 1, createdAt: '2026-11-10T10:00:00.000Z' }
const ADDRESSES: AddressRecord = { payment: { '0': OTHER_PAYMENT_0 }, binding: {} }

const makeStore = () => {
  const session = new FakeSeedSession()
  const store = new AskarSeedStore((callback) => callback(session))
  return { session, store }
}

describe('AskarSeedStore', () => {
  it('writes the seed in the crypto category with its kind, version and date as tags', async () => {
    const { session, store } = makeStore()

    await store.writeSeed(SEED, ADDRESSES)

    expect(session.rows.get(`${SEED_CATEGORY}/${SEED_ENTRY}`)).toEqual({
      category: 'crypto',
      name: 'seed',
      value: OTHER_MNEMONIC,
      tags: { kind: 'mnemonic', version: '1', createdAt: SEED.createdAt },
    })
  })

  it('writes the addresses as JSON next to the seed', async () => {
    const { session, store } = makeStore()

    await store.writeSeed(SEED, ADDRESSES)

    const row = session.rows.get(`${SEED_CATEGORY}/${ADDRESSES_ENTRY}`)
    expect(JSON.parse(String(row?.value))).toEqual(ADDRESSES)
  })

  it('reads back what it wrote', async () => {
    const { store } = makeStore()

    await store.writeSeed(SEED, ADDRESSES)

    await expect(store.hasSeed()).resolves.toBe(true)
    await expect(store.readSeed()).resolves.toEqual(SEED)
    await expect(store.readAddresses()).resolves.toEqual(ADDRESSES)
  })

  it('returns nothing when the store is empty', async () => {
    const { store } = makeStore()

    await expect(store.hasSeed()).resolves.toBe(false)
    await expect(store.readSeed()).resolves.toBeUndefined()
    await expect(store.readAddresses()).resolves.toBeUndefined()
  })

  it('refuses a second seed and keeps the first', async () => {
    const { store } = makeStore()
    await store.writeSeed(SEED, ADDRESSES)

    await expect(store.writeSeed({ ...SEED, secret: 'other' }, ADDRESSES)).rejects.toThrow(SeedExistsError)
    await expect(store.readSeed()).resolves.toEqual(SEED)
  })

  it('adds an address to the existing entry', async () => {
    const { session, store } = makeStore()
    await store.writeSeed(SEED, ADDRESSES)

    await expect(store.addAddress(SEED, 'payment', 1, '0x1')).resolves.toBe(true)

    expect(session.replace).toHaveBeenCalledTimes(1)
    await expect(store.readAddresses()).resolves.toEqual({ payment: { ...ADDRESSES.payment, '1': '0x1' }, binding: {} })
  })

  it('creates the addresses entry when it is missing', async () => {
    const { session, store } = makeStore()
    await store.writeSeed(SEED, ADDRESSES)
    session.rows.delete(`${SEED_CATEGORY}/${ADDRESSES_ENTRY}`)

    await expect(store.addAddress(SEED, 'binding', 0, '0xb')).resolves.toBe(true)

    await expect(store.readAddresses()).resolves.toEqual({ payment: {}, binding: { '0': '0xb' } })
  })

  it('does not write an address that is already there', async () => {
    const { session, store } = makeStore()
    await store.writeSeed(SEED, ADDRESSES)

    await expect(store.addAddress(SEED, 'payment', 0, OTHER_PAYMENT_0)).resolves.toBe(false)

    expect(session.replace).not.toHaveBeenCalled()
  })

  it('skips an address derived from a seed that was removed or replaced', async () => {
    const { session, store } = makeStore()
    await store.writeSeed(SEED, ADDRESSES)
    const replaced: SeedRecord = { ...SEED, secret: 'another phrase' }

    await expect(store.addAddress(replaced, 'payment', 0, '0xold')).resolves.toBe(false)
    await store.remove()
    await expect(store.addAddress(SEED, 'payment', 1, '0x1')).resolves.toBe(false)

    expect(session.rows.size).toBe(0)
  })

  it('removes both entries and leaves other categories alone', async () => {
    const { session, store } = makeStore()
    await store.writeSeed(SEED, ADDRESSES)
    session.rows.set('crypto-ledger/tx', { category: 'crypto-ledger', name: 'tx', value: '{}' })

    await store.remove()

    expect([...session.rows.keys()]).toEqual(['crypto-ledger/tx'])
  })

  it('removes nothing when there is nothing to remove', async () => {
    const { session, store } = makeStore()

    await store.remove()

    expect(session.remove).not.toHaveBeenCalled()
  })

  it.each([
    ['a non-string value', { value: 42, tags: { kind: 'mnemonic', version: '1' } }],
    ['an empty value', { value: '', tags: { kind: 'mnemonic', version: '1' } }],
    ['an unknown kind', { value: OTHER_MNEMONIC, tags: { kind: 'xpub', version: '1' } }],
    ['an unknown version', { value: OTHER_MNEMONIC, tags: { kind: 'mnemonic', version: '2' } }],
  ])('refuses a seed entry with %s', async (_case, row) => {
    const { session, store } = makeStore()
    session.rows.set('crypto/seed', { category: 'crypto', name: 'seed', ...row })

    await expect(store.readSeed()).rejects.toThrow(KeyStorageError)
  })

  it('never puts the seed into a storage error', async () => {
    const { session, store } = makeStore()
    session.rows.set('crypto/seed', { category: 'crypto', name: 'seed', value: OTHER_MNEMONIC, tags: {} })

    await expect(store.readSeed()).rejects.not.toThrow('wave wonder')
  })

  it.each([
    ['a non-string value', 7],
    ['not JSON', '{payment'],
    ['not an object', 'null'],
    ['no binding map', JSON.stringify({ payment: {} })],
    ['a non-string address', JSON.stringify({ payment: { '0': 1 }, binding: {} })],
  ])('refuses an addresses entry with %s', async (_case, value) => {
    const { session, store } = makeStore()
    session.rows.set('crypto/addresses', { category: 'crypto', name: 'addresses', value })

    await expect(store.readAddresses()).rejects.toThrow(KeyStorageError)
  })
})
