import type { KeyPurpose, SeedKind } from './KeyProvider'

export const SEED_RECORD_VERSION = 1

export interface SeedRecord {
  kind: SeedKind
  /** The normalised mnemonic, or the 0x-prefixed private key. */
  secret: string
  version: typeof SEED_RECORD_VERSION
  /** ISO 8601. */
  createdAt: string
}

/** Public addresses per branch and index (index as a decimal string), so reads never open the seed. */
export type AddressRecord = Record<KeyPurpose, Record<string, string>>

export const emptyAddressRecord = (): AddressRecord => ({ payment: {}, binding: {} })

/** True when both records hold the same secret, i.e. an address derived from one belongs to the other. */
export const isSameSeed = (a: SeedRecord, b: SeedRecord): boolean => a.kind === b.kind && a.secret === b.secret

/** Where the seed lives; the app backs it by the main agent's Askar store (`AskarSeedStore`). */
export interface SeedStorage {
  hasSeed(): Promise<boolean>
  readSeed(): Promise<SeedRecord | undefined>
  readAddresses(): Promise<AddressRecord | undefined>
  /** Writes both together; refuses with SeedExistsError when a seed is stored. */
  writeSeed(seed: SeedRecord, addresses: AddressRecord): Promise<void>
  /**
   * In one transaction: adds the address unless the stored seed is no longer the one it was derived from (removed
   * or replaced meanwhile) or the address is already there. Returns whether it wrote.
   */
  addAddress(derivedFrom: SeedRecord, purpose: KeyPurpose, index: number, address: string): Promise<boolean>
  /** Deletes the seed and the addresses; nothing else. */
  remove(): Promise<void>
}
