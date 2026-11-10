import type { KeyPurpose } from './KeyProvider'
import type { AddressRecord, SeedRecord, SeedStorage } from './SeedStorage'

import { SeedExistsError } from '../errors'

import { emptyAddressRecord, isSameSeed } from './SeedStorage'

const copyAddresses = (addresses: AddressRecord): AddressRecord => ({
  payment: { ...addresses.payment },
  binding: { ...addresses.binding },
})

/** In-memory storage for tests and Storybook; the app uses `AskarSeedStore`. */
export class MemorySeedStorage implements SeedStorage {
  private seed: SeedRecord | undefined
  private addresses: AddressRecord | undefined

  async hasSeed(): Promise<boolean> {
    return this.seed !== undefined
  }

  async readSeed(): Promise<SeedRecord | undefined> {
    return this.seed && { ...this.seed }
  }

  async readAddresses(): Promise<AddressRecord | undefined> {
    return this.addresses && copyAddresses(this.addresses)
  }

  async writeSeed(seed: SeedRecord, addresses: AddressRecord): Promise<void> {
    if (this.seed) throw new SeedExistsError('A seed is already stored')
    this.seed = { ...seed }
    this.addresses = copyAddresses(addresses)
  }

  async addAddress(derivedFrom: SeedRecord, purpose: KeyPurpose, index: number, address: string): Promise<boolean> {
    if (!this.seed || !isSameSeed(this.seed, derivedFrom)) return false
    const addresses = this.addresses ?? emptyAddressRecord()
    if (addresses[purpose][String(index)] === address) return false
    this.addresses = copyAddresses({ ...addresses, [purpose]: { ...addresses[purpose], [String(index)]: address } })
    return true
  }

  async remove(): Promise<void> {
    this.seed = undefined
    this.addresses = undefined
  }
}
