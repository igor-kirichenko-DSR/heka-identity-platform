import type { KeyPurpose, SeedKind } from './KeyProvider'
import type { AddressRecord, SeedRecord, SeedStorage } from './SeedStorage'

import { KeyStorageError, SeedExistsError } from '../errors'

import { emptyAddressRecord, isSameSeed, SEED_RECORD_VERSION } from './SeedStorage'

/** Spike C: a raw Askar category, listed by no Credo API. */
export const SEED_CATEGORY = 'crypto'
export const SEED_ENTRY = 'seed'
export const ADDRESSES_ENTRY = 'addresses'

interface EntryRef {
  category: string
  name: string
}

interface EntryWrite extends EntryRef {
  value: string
  tags?: Record<string, unknown>
}

/** The part of an Askar `Session` the seed store uses; core does not import Askar or Credo. */
export interface AskarSeedSessionLike {
  fetch(options: EntryRef): Promise<{ value: unknown; tags?: Record<string, unknown> } | null>
  insert(options: EntryWrite): Promise<void>
  replace(options: EntryWrite): Promise<void>
  remove(options: EntryRef): Promise<void>
}

/**
 * The app passes `createAgentTransactionRunner(mainAgent)` (Credo `withTransaction`), so the seed and its addresses
 * are written and removed together. Never the DC API agent.
 */
export type WithAskarSeedSession = <T>(callback: (session: AskarSeedSessionLike) => Promise<T>) => Promise<T>

const SEED_REF: EntryRef = { category: SEED_CATEGORY, name: SEED_ENTRY }
const ADDRESSES_REF: EntryRef = { category: SEED_CATEGORY, name: ADDRESSES_ENTRY }
const PURPOSES: KeyPurpose[] = ['payment', 'binding']

const isRecordOfStrings = (value: unknown): value is Record<string, string> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every((item) => typeof item === 'string')

const parseAddresses = (value: unknown): AddressRecord => {
  if (typeof value !== 'string') throw new KeyStorageError('The addresses entry has a non-string value')
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch (error) {
    throw new KeyStorageError(`The addresses entry is not JSON: ${String(error)}`)
  }
  if (typeof parsed !== 'object' || parsed === null) throw new KeyStorageError('The addresses entry is not an object')
  const record = parsed as Record<string, unknown>
  for (const purpose of PURPOSES) {
    if (!isRecordOfStrings(record[purpose]))
      throw new KeyStorageError(`The addresses entry has no valid ${purpose} map`)
  }
  return {
    payment: { ...(record.payment as Record<string, string>) },
    binding: { ...(record.binding as Record<string, string>) },
  }
}

const isSeedKind = (value: unknown): value is SeedKind => value === 'mnemonic' || value === 'raw'

// Never put the secret into an error message.
const parseSeed = (entry: { value: unknown; tags?: Record<string, unknown> }): SeedRecord => {
  const { value, tags } = entry
  if (typeof value !== 'string' || value.length === 0) throw new KeyStorageError('The seed entry has no string value')
  const kind = tags?.kind
  if (!isSeedKind(kind)) throw new KeyStorageError('The seed entry has no valid kind tag')
  if (tags?.version !== String(SEED_RECORD_VERSION)) throw new KeyStorageError('The seed entry has an unknown version')
  const createdAt = typeof tags?.createdAt === 'string' ? tags.createdAt : ''
  return { kind, secret: value, version: SEED_RECORD_VERSION, createdAt }
}

const toAddressesEntry = (addresses: AddressRecord): EntryWrite => ({
  ...ADDRESSES_REF,
  value: JSON.stringify(addresses),
})

/** The seed and its public addresses as two raw Askar entries; encrypted at rest by the store key (the PIN). */
export class AskarSeedStore implements SeedStorage {
  constructor(private readonly withSession: WithAskarSeedSession) {}

  hasSeed(): Promise<boolean> {
    return this.withSession(async (session) => (await session.fetch(SEED_REF)) !== null)
  }

  readSeed(): Promise<SeedRecord | undefined> {
    return this.withSession(async (session) => {
      const entry = await session.fetch(SEED_REF)
      return entry ? parseSeed(entry) : undefined
    })
  }

  readAddresses(): Promise<AddressRecord | undefined> {
    return this.withSession(async (session) => {
      const entry = await session.fetch(ADDRESSES_REF)
      return entry ? parseAddresses(entry.value) : undefined
    })
  }

  writeSeed(seed: SeedRecord, addresses: AddressRecord): Promise<void> {
    return this.withSession(async (session) => {
      if (await session.fetch(SEED_REF)) throw new SeedExistsError('A seed is already stored')
      await session.insert({
        ...SEED_REF,
        value: seed.secret,
        tags: { kind: seed.kind, version: String(seed.version), createdAt: seed.createdAt },
      })
      await this.putAddresses(session, addresses)
    })
  }

  addAddress(derivedFrom: SeedRecord, purpose: KeyPurpose, index: number, address: string): Promise<boolean> {
    return this.withSession(async (session) => {
      const seedEntry = await session.fetch(SEED_REF)
      if (!seedEntry || !isSameSeed(parseSeed(seedEntry), derivedFrom)) return false
      const addressesEntry = await session.fetch(ADDRESSES_REF)
      const addresses = addressesEntry ? parseAddresses(addressesEntry.value) : emptyAddressRecord()
      if (addresses[purpose][String(index)] === address) return false
      addresses[purpose][String(index)] = address
      await this.putAddresses(session, addresses, addressesEntry !== null)
      return true
    })
  }

  remove(): Promise<void> {
    return this.withSession(async (session) => {
      if (await session.fetch(SEED_REF)) await session.remove(SEED_REF)
      if (await session.fetch(ADDRESSES_REF)) await session.remove(ADDRESSES_REF)
    })
  }

  private async putAddresses(session: AskarSeedSessionLike, addresses: AddressRecord, exists?: boolean): Promise<void> {
    const entry = toAddressesEntry(addresses)
    if (exists ?? (await session.fetch(ADDRESSES_REF)) !== null) await session.replace(entry)
    else await session.insert(entry)
  }
}
